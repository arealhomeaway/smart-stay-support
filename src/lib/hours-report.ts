/**
 * Weekly hours report for Active Owners (Nov 25): the Admin settings, the fixed hours box built from the
 * existing totals and ownerPace(), and the next-send date. Browser and server safe; nothing here sends.
 */
import { ownerPace } from "@/lib/ao-engine";
import { centralParts, weekStartOf } from "@/lib/owner-tab";
import { programWindowEnd } from "@/lib/owner-participation";

export const HOURS_REPORT_KEY = "ao_hours_report";
export const SEND_DAYS = [
  { dow: 1, label: "Monday" },
  { dow: 2, label: "Tuesday" },
  { dow: 3, label: "Wednesday" },
  { dow: 4, label: "Thursday" },
  { dow: 5, label: "Friday" },
] as const;

export type HoursReportSettings = {
  enabled: boolean;
  /** 1 Monday ... 5 Friday. */
  day: number;
  /** HH:MM, Central. */
  time: string;
  subject: string;
  opening: string;
  closing: string;
};

export const HOURS_REPORT_DEFAULTS: HoursReportSettings = {
  enabled: true,
  day: 1,
  time: "09:00",
  subject: "Your Active Owner hours this week",
  opening: "Hi {{First Name}},\nHere's where your hours stand as of {{Date}}.",
  closing: "Thank you!\nThe ARHA Team",
};

export function readHoursReportSettings(raw: unknown): HoursReportSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof HoursReportSettings, unknown>>;
  const d = HOURS_REPORT_DEFAULTS;
  const day = typeof v.day === "number" && v.day >= 1 && v.day <= 5 ? Math.trunc(v.day) : d.day;
  const time = typeof v.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time) ? v.time : d.time;
  const str = (x: unknown, f: string) => (typeof x === "string" && x.trim() ? x : f);
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : d.enabled,
    day,
    time,
    subject: str(v.subject, d.subject),
    opening: str(v.opening, d.opening),
    closing: str(v.closing, d.closing),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => r1(n).toFixed(1).replace(/\.0$/, ".0");

/** {{Date}}: Weekday, Month Day in Central time, for example "Monday, November 30". */
export function reportDateLabel(now: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" }).format(now);
}

export function mergeFields(text: string, f: { firstName: string; date: string }): string {
  return text.replace(/\{\{\s*First Name\s*\}\}/g, f.firstName).replace(/\{\{\s*Date\s*\}\}/g, f.date);
}

/** End of the program's last day (ends_on, else December 31 of the closing year), Central. */
export function programEndInstant(endsOn: string | null | undefined, startedOn: string | null | undefined): Date | null {
  const end = endsOn && /^\d{4}-\d{2}-\d{2}/.test(endsOn) ? endsOn.slice(0, 10) : programWindowEnd(startedOn);
  return end ? new Date(`${end}T23:59:59-06:00`) : null;
}

/** The fixed hours box (section 3), built every send. Never editable. */
export function hoursBoxLines(reportedMinutes: number, end: Date, now: Date): string[] {
  const logged = r1(reportedMinutes / 60);
  const lines = [`Hours logged: ${fmt(logged)}`];
  lines.push(logged > 100 ? "You've passed 100 hours." : `To reach 100 hours: ${fmt(100 - logged)} more`);
  lines.push(logged > 120 ? "You've passed 120 hours." : `To reach 120 hours (our recommendation): ${fmt(120 - logged)} more`);
  if (logged < 100) {
    const weeksLeft = (end.getTime() - now.getTime()) / (7 * 86_400_000);
    if (weeksLeft < 1) lines.push(`To reach 100 by December 31: ${fmt(100 - logged)} hours this week.`);
    else lines.push(`To reach 100 by December 31: about ${fmt(ownerPace(logged, now, end, 100).weeklyNeeded)} hours a week (${fmt(weeksLeft)} weeks left)`);
  }
  return lines;
}

export const LOG_HOURS_LABEL = "Log my hours";
export const LOG_HOURS_PATH = "/owner/history";

export function renderHoursReport(s: HoursReportSettings, input: { firstName: string | null; reportedMinutes: number; end: Date; now: Date }) {
  const f = { firstName: input.firstName?.trim() || "there", date: reportDateLabel(input.now) };
  const box = hoursBoxLines(input.reportedMinutes, input.end, input.now);
  const subject = mergeFields(s.subject, f);
  const body = [mergeFields(s.opening, f), box.join("\n"), mergeFields(s.closing, f)].join("\n\n");
  return { subject, body, box };
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Due now: the saved day, at or after the saved time, Central. */
export function hoursReportDue(s: HoursReportSettings, now: Date): { due: boolean; weekStart: string } {
  const c = centralParts(now);
  return { due: s.enabled && c.dow === s.day && c.minutes >= toMinutes(s.time), weekStart: weekStartOf(c.date) };
}

/**
 * The next send date for one home. A week already sent or held moves to the next week; a send date after
 * the program end means no more sends.
 */
export function nextHoursReportDate(
  s: HoursReportSettings,
  now: Date,
  opts: { sentWeeks: string[]; heldWeeks: string[]; endsOn: string | null },
): string | null {
  if (!s.enabled) return null;
  const c = centralParts(now);
  const ws = weekStartOf(c.date);
  for (let k = 0; k < 60; k++) {
    const week = addDays(ws, k * 7);
    const date = addDays(week, s.day - 1);
    if (opts.endsOn && date > opts.endsOn.slice(0, 10)) return null;
    if (opts.sentWeeks.includes(week) || opts.heldWeeks.includes(week)) continue;
    if (date < c.date) continue;
    if (date === c.date && c.minutes >= toMinutes(s.time) + 60) continue;
    return date;
  }
  return null;
}

export function shortDayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
}
export function timeLabel(t: string): string {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3, 5);
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"} Central`;
}
