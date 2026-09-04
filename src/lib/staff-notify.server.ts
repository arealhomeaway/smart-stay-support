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
 *  - A person is never emailed about their own action (enforced in the trigger).
 *  - One email per notification. A failed attempt is retried a few times, then
 *    marked failed so it is visible instead of silent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const APP_URL = "https://smart-stay-support.lovable.app";
const MAX_ATTEMPTS = 3;

/** Human label for the button in the email. */
function actionLabel(kind: string) {
  if (kind.startsWith("handoff")) return "Open the handoff";
  if (kind === "approval_required") return "Review the approval";
  return "Open in Resolve";
}

/** Sends every staff notification still waiting on email. Safe to run on a schedule. */
export async function drainStaffNotifications(supabase: Client, limit = 50) {
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

  const { sendEmail, emailShell, isEmailAddress } = await import("./email.server");

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
