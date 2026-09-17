/**
 * Delivery of staff notifications (server-only).
 *
 * Database triggers write every actionable event into `staff_notifications`
 * with the in-app copy already resolved. The in-app inbox is therefore live the
 * moment the event happens. This drain is only responsible for the email
 * fan-out of the rows that asked for one (`email_status = 'pending'`).
 *
 * Rules that must not drift:
 *  - Demo rows never reach a real mailbox.
 *  - Private staff copy only reaches a currently enabled internal staff account.
 *  - A person is never emailed about their own action (enforced in the trigger).
 *  - One email per notification. A failed attempt is retried a few times, then
 *    marked failed so it is visible instead of silent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const APP_URL = "https://smart-stay-support.lovable.app";
const MAX_ATTEMPTS = 3;

type Delivery = Pick<
  typeof import("./email.server"),
  "sendEmail" | "emailShell" | "isEmailAddress"
>;

async function eligibleStaffRecipient(supabase: Client, userId: string) {
  const [staff, roles, account] = await Promise.all([
    supabase.rpc("is_internal_staff", { _user_id: userId }),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.auth.admin.getUserById(userId),
  ]);
  if (staff.error || roles.error || account.error) {
    throw new Error("Staff recipient access could not be verified; email remains pending.");
  }
  const user = account.data.user;
  return (
    staff.data === true &&
    Boolean(roles.data?.length) &&
    !roles.data?.some(({ role }) => role === "owner" || role === "vendor") &&
    user?.id === userId &&
    !user.deleted_at &&
    (!user.banned_until || Date.parse(user.banned_until) <= Date.now())
  );
}

/** Human label for the button in the email. */
function actionLabel(kind: string) {
  if (kind.startsWith("handoff")) return "Open the handoff";
  if (kind === "approval_required") return "Review the approval";
  return "Open in Resolve";
}

/** Sends every staff notification still waiting on email. Safe to run on a schedule. */
export async function drainStaffNotifications(supabase: Client, limit = 50, delivery?: Delivery) {
  const { data, error } = await supabase
    .from("staff_notifications")
    .select("id, user_id, kind, title, body, link_path, priority, email_attempts, is_demo")
    .eq("email_status", "pending")
    .order("created_at")
    .limit(limit);
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0)
    return { ok: true as const, considered: 0, emailed: 0, notes: [] as string[] };

  const { sendEmail, emailShell, isEmailAddress } = delivery ?? (await import("./email.server"));

  // One lookup for every recipient in this batch.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  const emailFor = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  let emailed = 0;
  const notes: string[] = [];

  for (const row of rows) {
    if (row.is_demo) {
      await supabase
        .from("staff_notifications")
        .update({
          email_status: "skipped",
          email_error: "Demo notification — external delivery blocked.",
        })
        .eq("id", row.id);
      continue;
    }

    // Approval triggers can address an owner, and a queued teammate can lose
    // staff access. Recheck the account before sharing this private copy.
    let eligible: boolean;
    try {
      eligible = await eligibleStaffRecipient(supabase, row.user_id);
    } catch {
      notes.push("Staff recipient access could not be verified; email remains pending.");
      continue;
    }
    if (!eligible) {
      const reason = "Recipient is not an enabled internal staff account; private email blocked.";
      const { error: skippedError } = await supabase
        .from("staff_notifications")
        .update({ email_status: "skipped", email_error: reason })
        .eq("id", row.id)
        .eq("email_status", "pending");
      notes.push(skippedError ? skippedError.message : reason);
      continue;
    }

    const to = emailFor.get(row.user_id);
    if (!isEmailAddress(to)) {
      await supabase
        .from("staff_notifications")
        .update({
          email_status: "skipped",
          email_error: "No email address on file for this teammate.",
        })
        .eq("id", row.id);
      continue;
    }

    const url = row.link_path ? `${APP_URL}${row.link_path}` : APP_URL;
    const result = await sendEmail({
      to,
      subject: row.priority === "urgent" ? `Action needed — ${row.title}` : row.title,
      html: emailShell(row.title, row.body, { label: actionLabel(row.kind), url }, "staff"),
      purpose: `staff_${row.kind}`,
    });

    const attempts = (row.email_attempts ?? 0) + 1;
    const patch: Database["public"]["Tables"]["staff_notifications"]["Update"] = {
      email_attempts: attempts,
      delivered_at: new Date().toISOString(),
    };

    if (result.status === "sent") {
      patch.email_status = "sent";
      emailed++;
    } else if (result.status === "skipped") {
      patch.email_status = "skipped";
      patch.email_error = result.error ?? "Email is not configured.";
    } else {
      // Leave it pending so the next pass retries, until we run out of patience.
      patch.email_status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      patch.email_error = result.error ?? "Delivery failed.";
      if (result.error) notes.push(result.error);
    }

    const { error: updateError } = await supabase
      .from("staff_notifications")
      .update(patch)
      .eq("id", row.id);
    if (updateError) notes.push(updateError.message);
  }

  return { ok: true as const, considered: rows.length, emailed, notes };
}
