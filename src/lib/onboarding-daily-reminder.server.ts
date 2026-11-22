/**
 * Runs the onboarding 8 AM reminder on the five-minute job and sends held onboarding emails to the
 * test inbox. Skipped quietly until docs/pending/onboarding-notify-escalate is applied.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { APP_URL, emailRecipient, localParts, reminderBody, reminderDue, reminderEmailHtml, reminderLines, reminderTitle, testInbox, type ReminderTask } from "./onboarding-daily-reminder";
import type { HomeTeam } from "./plan-task-owner";

type Client = SupabaseClient<Database>;
type Loose = { from: (t: string) => any };

function missing(e: { code?: string; message?: string } | null | undefined) {
  return Boolean(e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST205" || /does not exist|could not find/i.test(e.message ?? "")));
}

export async function readTestInbox(supabase: Client): Promise<string | null> {
  const { data } = await (supabase as unknown as Loose).from("app_settings").select("value").eq("key", "onboarding_email_test_inbox").maybeSingle();
  return testInbox(data?.value);
}

export async function runOnboardingDailyReminders(supabase: Client, now: Date = new Date()) {
  const sb = supabase as unknown as Loose;
  const probe = await sb.from("onboarding_daily_reminders").select("user_id").limit(1);
  if (probe.error) return { ok: true as const, skipped: missing(probe.error) ? "not switched on" : probe.error.message };

  const profiles = await sb.from("profiles").select("id, email, full_name, time_zone").is("removed_at", null);
  if (profiles.error) return { ok: true as const, skipped: profiles.error.message };
  const people = (profiles.data ?? []) as { id: string; email: string | null; full_name: string | null; time_zone: string | null }[];
  const due = people.filter((p) => reminderDue(now, p.time_zone));
  if (due.length === 0) return { ok: true as const, sent: 0 };

  const latestDay = localParts(new Date(now.getTime() + 14 * 3600_000), "Pacific/Kiritimati").day;
  const [projectsRes, tasksRes] = await Promise.all([
    sb.from("onboarding_projects").select("property_id, project_manager, director, utility_manager, role_assignments, status, is_demo, created_at")
      .eq("status", "active").eq("is_demo", false).order("created_at", { ascending: true }),
    sb.from("onboarding_tasks").select("id, title, property_id, due_on, status, assigned_to, assigned_seat, archived_at, exception_at")
      .eq("is_demo", false).is("archived_at", null).not("due_on", "is", null).lte("due_on", latestDay).limit(5000),
  ]);
  if (projectsRes.error || tasksRes.error) return { ok: true as const, skipped: (projectsRes.error ?? tasksRes.error).message };
  const projects = new Map<string, HomeTeam>();
  for (const p of (projectsRes.data ?? []) as (HomeTeam & { property_id: string })[]) projects.set(p.property_id, p);
  const tasks = ((tasksRes.data ?? []) as ReminderTask[]).filter((t) => projects.has(t.property_id));
  const propIds = [...new Set(tasks.map((t) => t.property_id))];
  const homes = propIds.length ? await sb.from("properties").select("id, nickname, name, address_line1").in("id", propIds) : { data: [] };
  const homeName = new Map(((homes.data ?? []) as { id: string; nickname: string | null; name: string | null; address_line1: string | null }[])
    .map((h) => [h.id, h.address_line1 || h.nickname || h.name || "A home"]));
  const inbox = await readTestInbox(supabase);
  const { sendEmail } = await import("./email.server");

  let sent = 0;
  const notes: string[] = [];
  for (const person of due) {
    const local = localParts(now, person.time_zone);
    const lines = reminderLines({ userId: person.id, localDay: local.day, tasks, projects, homeName: (id) => homeName.get(id) ?? "A home" });
    if (lines.length === 0) continue;
    // Claim the day first, so a second pass in the same hour never sends twice.
    const claim = await sb.from("onboarding_daily_reminders")
      .insert({ user_id: person.id, local_day: local.day, time_zone: local.timeZone, task_ids: lines.map((l) => l.id) });
    if (claim.error) {
      if (claim.error.code !== "23505") notes.push(claim.error.message);
      continue;
    }
    const notice = await sb.from("staff_notifications").insert({
      user_id: person.id, kind: "onboarding_daily_reminder", title: reminderTitle(lines), body: reminderBody(lines),
      entity_type: "onboarding_daily_reminder", link_path: "/onboarding/my-work", priority: "normal", email_status: "none", is_demo: false,
    }).select("id").single();
    const to = emailRecipient(person.email, inbox);
    let status: "sent" | "skipped" | "failed" = "skipped";
    if (to) {
      const result = await sendEmail({
        to,
        subject: inbox ? `[Test copy] ${reminderTitle(lines)}` : reminderTitle(lines),
        html: reminderEmailHtml(lines, APP_URL),
        purpose: "staff_onboarding_daily_reminder",
        entity: notice.data?.id ? { type: "staff_notification", id: notice.data.id } : null,
      });
      status = result.status === "sent" ? "sent" : result.status;
      if (result.status !== "sent") notes.push(result.error);
      if (result.status === "sent") sent++;
    }
    await sb.from("onboarding_daily_reminders").update({ notification_id: notice.data?.id ?? null, emailed_to: to, email_status: status })
      .eq("user_id", person.id).eq("local_day", local.day);
  }
  return { ok: true as const, sent, notes };
}

/**
 * Onboarding emails held for testing (email_status 'held') go only to the test inbox, once each.
 * With no test inbox set they stay held and are never sent.
 */
export async function drainHeldOnboardingEmails(supabase: Client, limit = 50) {
  const inbox = await readTestInbox(supabase);
  if (!inbox) return { ok: true as const, sent: 0 };
  const sb = supabase as unknown as Loose;
  const rows = await sb.from("staff_notifications").select("id, kind, title, body, link_path, is_demo, user_id")
    .eq("email_status", "held").order("created_at").limit(limit);
  if (rows.error) return { ok: true as const, skipped: rows.error.message };
  const { sendEmail, emailShell } = await import("./email.server");
  let sent = 0;
  for (const row of (rows.data ?? []) as { id: string; kind: string; title: string; body: string | null; link_path: string | null; is_demo: boolean }[]) {
    const result = await sendEmail({
      to: inbox,
      subject: `[Test copy] ${row.title}`,
      html: emailShell(row.title, row.body ?? "", { label: "Open in Resolve", url: `${APP_URL}${row.link_path ?? ""}` }, "staff"),
      purpose: `staff_${row.kind}_test_copy`,
      isDemo: row.is_demo,
      entity: { type: "staff_notification", id: row.id },
    });
    await sb.from("staff_notifications").update({
      email_status: result.status === "sent" ? "sent" : result.status === "skipped" ? "skipped" : "held",
      email_error: result.status === "sent" ? "Test copy sent to the test inbox only." : result.error,
      delivered_at: new Date().toISOString(),
    }).eq("id", row.id).eq("email_status", "held");
    if (result.status === "sent") sent++;
  }
  return { ok: true as const, sent };
}
