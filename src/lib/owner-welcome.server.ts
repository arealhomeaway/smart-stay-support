/**
 * Delivers queued Active Owner welcome emails. Runs on the five-minute notify
 * pass. A welcome goes out only once the Onboarding Director has marked the
 * wording approved; demo programs never send. Each row is claimed before
 * sending so a second pass can never double up.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPropertyLabel, type PropertyLabelFields } from "./property-label";
import { OWNER_WELCOME_KEY, readWelcomeTemplate, renderWelcome } from "./owner-welcome";

const APP_ORIGIN = "https://smart-stay-support.lovable.app";
export const PORTAL_LINK = `${APP_ORIGIN}/owner`;
export const WELCOME_VIDEO_LINK = `${APP_ORIGIN}/welcome-video`;
const TEST_ADDRESS = /@(resolve-test\.invalid|[^@]+\.(invalid|test|example))$/i;

export async function loadWelcomeTemplate(db: SupabaseClient) {
  const { data } = await db.from("app_settings").select("value").eq("key", OWNER_WELCOME_KEY).maybeSingle();
  return readWelcomeTemplate((data as { value?: unknown } | null)?.value);
}

export function videoLinkFor(tpl: ReturnType<typeof readWelcomeTemplate>) {
  if (!tpl.video) return null;
  return tpl.video.kind === "link" ? tpl.video.url : WELCOME_VIDEO_LINK;
}

/** Owner name and every included home on the program, for the greeting. */
export async function welcomeContext(db: SupabaseClient, programId: string, ownerUserId: string) {
  const [profile, homes] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", ownerUserId).maybeSingle(),
    db
      .from("owner_program_properties")
      .select("closing_confirmed, closing_date, properties(name, nickname, address_line1, unit, city, state, postal_code)")
      .eq("program_id", programId)
      .eq("inclusion_status", "included")
      .is("archived_at", null),
  ]);
  if (homes.error) throw new Error("The welcome's home address could not be loaded.");
  const names = ((homes.data ?? []) as unknown as { properties: PropertyLabelFields | null }[])
    .map((h) => h.properties ? formatPropertyLabel(h.properties).primary : "")
    .filter(Boolean);
  const hoursOpen = (homes.data ?? []).length > 0;
  return { ownerName: (profile.data as { full_name?: string } | null)?.full_name ?? null, propertyNames: names, hoursOpen };
}

export async function drainOwnerWelcomes(db: SupabaseClient, limit = 20, jobRunId?: string) {
  const tpl = await loadWelcomeTemplate(db);
  if (tpl.review !== "approved") return { considered: 0, sent: 0, waiting: "wording_not_approved" as const };
  const { data: due } = await db
    .from("owner_welcome_messages")
    .select("id, program_id, owner_user_id, recipient, attempts")
    .eq("status", "queued")
    .eq("is_demo", false)
    .order("queued_at")
    .limit(limit);
  const { sendEmail, emailShell } = await import("./email.server");
  let sent = 0;
  const notes: string[] = [];
  for (const row of (due ?? []) as { id: string; program_id: string; owner_user_id: string; recipient: string; attempts: number }[]) {
    const { data: claimed } = await db
      .from("owner_welcome_messages")
      .update({ status: "sending", attempts: row.attempts + 1 } as never)
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id");
    if (!claimed?.length) continue;
    const ctx = await welcomeContext(db, row.program_id, row.owner_user_id);
    const videoLink = videoLinkFor(tpl);
    let setPasswordLink: string | undefined;
    if (tpl.body.includes("{{set_password_link}}")) {
      const { verifyEmailSafety } = await import("./email-safety.server");
      const blocked = await verifyEmailSafety({ to: row.recipient, entity: { type: "owner_program", id: row.program_id } }, db);
      if (blocked) {
        await db.from("owner_welcome_messages").update({ status: "failed", error_message: blocked } as never).eq("id", row.id);
        continue;
      }
      // Generates a recovery link only after approval, claim and safety; never sends an auth email.
      const link = await db.auth.admin.generateLink({ type: "recovery", email: row.recipient,
        options: { redirectTo: `${APP_ORIGIN}/reset-password` } });
      setPasswordLink = link.data?.properties?.action_link;
      if (link.error || !setPasswordLink || !setPasswordLink.startsWith("https://")) {
        await db.from("owner_welcome_messages").update({ status: "failed", error_message: "Could not prepare the secure password link." } as never).eq("id", row.id);
        continue;
      }
    }
    const msg = renderWelcome(tpl, { ...ctx, portalLink: PORTAL_LINK, videoLink, ...(setPasswordLink ? { setPasswordLink } : {}) });
    const auditBody = setPasswordLink ? msg.body.replaceAll(setPasswordLink, "[Secure password link omitted]") : msg.body;
    if (TEST_ADDRESS.test(row.recipient)) {
      await db.from("owner_welcome_messages").update({
        status: "failed", error_message: "Test address — never emailed.", subject: msg.subject, body: msg.body,
        template_version: tpl.version, video_url: videoLink,
      } as never).eq("id", row.id);
      continue;
    }
    const result = await sendEmail({
      to: row.recipient,
      subject: msg.subject,
      html: emailShell(msg.subject, msg.body, { label: "Open your portal", url: PORTAL_LINK }, "owner" as never),
      purpose: "owner_welcome",
      entity: { type: "owner_program", id: row.program_id },
      bodyText: auditBody,
      singleAttempt: true,
      preserveUncertainty: true,
      ...(jobRunId ? { jobRunId, jobPart: "welcomes" } : {}),
    });
    await db.from("owner_welcome_messages").update({
      status: result.status === "sent" ? "sent" : result.deliveryUncertain ? "sending" : "failed",
      error_message: result.status === "sent" ? null : `${result.deliveryUncertain ? "Delivery uncertain: " : ""}${result.error ?? "Delivery failed"}`,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
      subject: msg.subject, body: auditBody, template_version: tpl.version, video_url: videoLink,
    } as never).eq("id", row.id).eq("status", "sending").eq("attempts", row.attempts + 1);
    if (result.status === "sent") sent += 1;
    if (result.status === "failed") notes.push(result.error);
  }
  return { considered: (due ?? []).length, sent, notes };
}

/**
 * Staff retry of a confirmed failure: moves only a failed, non-demo, real-address
 * welcome back to queued. A row left "sending" (uncertain provider result) is
 * never re-queued here, so nothing is sent blindly twice.
 */
export async function retryOwnerWelcome(db: SupabaseClient, id: string) {
  const { data: row } = await db.from("owner_welcome_messages").select("id, status, is_demo, recipient").eq("id", id).maybeSingle();
  const r = row as { status: string; is_demo: boolean; recipient: string } | null;
  if (!r) throw new Error("Welcome not found.");
  if (r.is_demo) throw new Error("Demo welcomes are never sent.");
  if (TEST_ADDRESS.test(r.recipient)) throw new Error("Test addresses are never emailed.");
  if (r.status !== "failed") throw new Error("Only a welcome that was not delivered can be retried.");
  const { data: moved } = await db
    .from("owner_welcome_messages")
    .update({ status: "queued", error_message: null } as never)
    .eq("id", id)
    .eq("status", "failed")
    .select("id");
  return { requeued: Boolean(moved?.length) };
}

