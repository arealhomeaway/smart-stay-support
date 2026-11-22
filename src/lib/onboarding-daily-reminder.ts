/**
 * The onboarding 8 AM reminder (pure rules, browser-safe).
 * Each person gets one reminder a day at 8:00 AM in their own time zone, in the app and by email,
 * listing their overdue and due-today plan Tasks, each linked. The Task's owner is planTaskOwner.
 * While the test inbox is set, every onboarding email goes only to that address.
 */
import { planTaskOwner, type HomeTeam } from "./plan-task-owner";

export const REMINDER_HOUR = 8;
export const DEFAULT_TIME_ZONE = "America/Chicago";
export const APP_URL = "https://smart-stay-support.lovable.app";
const FINISHED = new Set(["complete", "completed", "carryover", "not_required", "void", "cancelled"]);

/** The local calendar day (YYYY-MM-DD) and hour for a time zone; Central when the zone is unknown. */
export function localParts(now: Date, timeZone: string | null | undefined): { day: string; hour: number; timeZone: string } {
  const tz = validTimeZone(timeZone) ? timeZone! : DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(now);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), timeZone: tz };
}

export function validTimeZone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** True during the 8 AM hour in the person's time zone. */
export function reminderDue(now: Date, timeZone: string | null | undefined): boolean {
  return localParts(now, timeZone).hour === REMINDER_HOUR;
}

export type ReminderTask = {
  id: string;
  title: string;
  property_id: string;
  due_on: string | null;
  status: string;
  assigned_to: string | null;
  assigned_seat?: string | null;
  archived_at?: string | null;
  exception_at?: string | null;
};

export type ReminderLine = { id: string; title: string; home: string; dueOn: string; overdue: boolean; link: string };

/** One person's overdue and due-today Tasks on their local day, overdue first, oldest first. */
export function reminderLines(input: {
  userId: string;
  localDay: string;
  tasks: ReminderTask[];
  projects: Map<string, HomeTeam>;
  homeName: (propertyId: string) => string;
}): ReminderLine[] {
  return input.tasks
    .filter((t) => !t.archived_at && !t.exception_at && t.due_on && t.due_on <= input.localDay)
    .filter((t) => !FINISHED.has((t.status ?? "").toLowerCase()))
    .filter((t) => planTaskOwner(t, input.projects.get(t.property_id)) === input.userId)
    .sort((a, b) => (a.due_on! < b.due_on! ? -1 : a.due_on! > b.due_on! ? 1 : a.title.localeCompare(b.title)))
    .map((t) => ({
      id: t.id,
      title: t.title,
      home: input.homeName(t.property_id),
      dueOn: t.due_on!,
      overdue: t.due_on! < input.localDay,
      link: `/onboarding/${t.property_id}?tab=tasks&task=${t.id}`,
    }));
}

export function reminderTitle(lines: ReminderLine[]): string {
  const late = lines.filter((l) => l.overdue).length;
  const today = lines.length - late;
  const parts = [late ? `${late} overdue` : null, today ? `${today} due today` : null].filter(Boolean);
  return `Your onboarding Tasks: ${parts.join(", ")}`;
}

/** The in-app body: one line per Task (the notice opens My Tasks, where each is linked). */
export function reminderBody(lines: ReminderLine[]): string {
  const shown = lines.slice(0, 12).map((l) => `${l.overdue ? "Overdue" : "Today"}: ${l.title} · ${l.home}`);
  if (lines.length > 12) shown.push(`and ${lines.length - 12} more`);
  return shown.join("\n");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email: every Task listed and linked. */
export function reminderEmailHtml(lines: ReminderLine[], appUrl = APP_URL): string {
  const section = (label: string, rows: ReminderLine[]) =>
    rows.length
      ? `<h2 style="font-size:16px;margin:16px 0 6px">${esc(label)} (${rows.length})</h2><ul style="padding-left:18px;margin:0">${rows
          .map((l) => `<li style="margin:0 0 6px"><a href="${esc(appUrl + l.link)}">${esc(l.title)}</a> · ${esc(l.home)}${l.overdue ? ` · due ${esc(l.dueOn)}` : ""}</li>`)
          .join("")}</ul>`
      : "";
  return `<!doctype html><html><body style="font-family:Calibri,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#20282b;background:#ffffff;padding:16px">
<h1 style="font-size:20px;margin:0 0 8px">${esc(reminderTitle(lines))}</h1>
${section("Overdue", lines.filter((l) => l.overdue))}${section("Due today", lines.filter((l) => !l.overdue))}
<p style="margin:20px 0 0"><a href="${esc(appUrl)}/onboarding/my-work">Open My Tasks</a></p>
<p style="font-size:12px;color:#5f6b6f;margin:20px 0 0">A Real Home Away</p></body></html>`;
}

/** The test inbox address while testing, else null (emails go to their real recipients). */
export function testInbox(settingValue: unknown): string | null {
  const email = settingValue && typeof settingValue === "object" ? (settingValue as { email?: unknown }).email : null;
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim() : null;
}

/** Who an onboarding email really goes to: the test inbox while it is set, else the person. */
export function emailRecipient(personEmail: string | null, inbox: string | null): string | null {
  return inbox ?? personEmail;
}
