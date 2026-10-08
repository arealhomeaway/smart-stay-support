/**
 * Delivers queued Active Owner welcome emails. Runs on the five-minute notify
 * pass. A welcome goes out only once the Onboarding Director has marked the
 * wording approved; demo programs never send. Each row is claimed before
 * sending so a second pass can never double up.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { businessToday } from "./owner-hours-eligibility";
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
      .select("closing_confirmed, closing_date, properties(name, address)")
      .eq("program_id", programId)
      .eq("inclusion_status", "included")
      .is("archived_at", null),
  ]);
  const names = ((homes.data ?? []) as unknown as { properties: { name: string | null; address: string | null } | null }[])
    .map((h) => h.properties?.name || h.properties?.address || "")
    .filter(Boolean);
  const today = businessToday();
  const hoursOpen = ((homes.data ?? []) as unknown as { closing_confirmed: boolean; closing_date: string | null }[])
    .some((h) => h.closing_confirmed && !!h.closing_date && h.closing_date <= today);
  return { ownerName: (profile.data as { full_name?: string } | null)?.full_name ?? null, propertyNames: names, hoursOpen };
}

export async function drainOwnerWelcomes(db: SupabaseClient, limit = 20) {
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
    const msg = renderWelcome(tpl, { ...ctx, portalLink: PORTAL_LINK, videoLink });
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
      bodyText: msg.body,
      singleAttempt: true,
    });
    await db.from("owner_welcome_messages").update({
      status: result.status === "sent" ? "sent" : "failed",
      error_message: result.status === "sent" ? null : (result.error ?? "Delivery failed"),
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
      subject: msg.subject, body: msg.body, template_version: tpl.version, video_url: videoLink,
    } as never).eq("id", row.id);
    if (result.status === "sent") sent += 1;
  }
  return { considered: (due ?? []).length, sent };
}
