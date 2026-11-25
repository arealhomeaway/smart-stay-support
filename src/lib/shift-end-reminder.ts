/**
 * Shift-end reminder (change 5 of 5, items 1 and 2). Pure rules: when the banner shows,
 * which tickets count as due today, and the banner words. Who receives each handoff comes
 * from the database (shift_handoff_defaults), which already skips people on time off.
 */
import { centralInstant, centralToday } from "@/lib/team-schedule";
import type { MyShiftToday } from "@/lib/my-shift";

export const SHIFT_END_LEAD_MINUTES = 30;
const TZ = "America/Chicago";

function minuteNow(now: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return g("hour") * 60 + g("minute");
}

/** The shift end (ISO) when the person is in the last 30 minutes of a shift block, else null. */
export function shiftEndSoon(s: Pick<MyShiftToday, "blocks" | "off" | "date">, now: Date = new Date()): string | null {
  if (s.off) return null;
  const m = minuteNow(now);
  const block = s.blocks.find((b) => m >= b.start && m < b.end);
  if (!block || block.end - m > SHIFT_END_LEAD_MINUTES) return null;
  // A block that runs straight into the person's next block is not the end of the shift.
  if (s.blocks.some((b) => b !== block && b.start === block.end)) return null;
  return centralInstant(s.date, block.end);
}

export type DueTicket = {
  status: string;
  priority?: string | null;
  due_on?: string | null;
  response_due_at?: string | null;
  action_due_at?: string | null;
};

/** Same-day due: the due date is today (Central), or the clock runs out today, or it is already late. */
export function dueToday(t: DueTicket, now: Date = new Date()): boolean {
  if (["resolved", "closed"].includes(t.status)) return false;
  const today = centralToday(now);
  if (t.due_on) return t.due_on <= today;
  const ms = Date.parse(t.response_due_at ?? t.action_due_at ?? "");
  if (!Number.isFinite(ms)) return false;
  return centralToday(new Date(ms)) <= today;
}

export function centralTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function bannerText(endIso: string, n: number): string {
  return `Prepare your handoffs. Your shift ends at ${centralTimeLabel(endIso)} and ${n} open ticket${n === 1 ? " has a" : "s have"} same-day due date${n === 1 ? "" : "s"}.`;
}

/** Later hides the banner for this shift end only. */
export const laterKey = (userId: string, endIso: string) => `shift-end-later:${userId}:${endIso}`;
