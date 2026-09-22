/**
 * Owner-facing deadlines, administered in Central Time.
 *
 * The Welcome Packet tells the homeowner two things about a deadline: it is
 * administered in Central Time (CT), and silence is not approval. Both live
 * here so every surface says the same thing.
 */

import { usCalendarDate } from "./dates";

export const SILENCE_IS_NOT_APPROVAL =
  "Deadlines are administered in Central Time. A response is needed — silence is not approval.";

/** Today's calendar date in Central Time, as YYYY-MM-DD. */
export function centralToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

/** "10/03/2026 (CT)" — never a bare date, so the timezone is never assumed. */
export function centralDeadline(value: string | null | undefined, fallback = "—"): string {
  const formatted = usCalendarDate(value, fallback);
  return formatted === fallback ? fallback : `${formatted} (CT)`;
}

/** Days until a stored calendar deadline, measured in Central Time. */
export function daysUntilDeadline(
  value: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
  const target = day(value);
  const today = day(centralToday(now));
  if (Number.isNaN(target) || Number.isNaN(today)) return null;
  return target - today;
}

export type DeadlineState = {
  /** "Needed by 10/03/2026 (CT)" */
  label: string;
  overdue: boolean;
  dueToday: boolean;
  /** Short state for a badge, or null when the date is comfortably ahead. */
  note: string | null;
};

/** How one owner deadline reads: the date, and whether it has slipped. */
export function deadlineState(
  value: string | null | undefined,
  now: Date = new Date(),
): DeadlineState | null {
  const days = daysUntilDeadline(value, now);
  if (days == null) return null;
  const label = `Needed by ${centralDeadline(value)}`;
  if (days < 0)
    return {
      label,
      overdue: true,
      dueToday: false,
      note: `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`,
    };
  if (days === 0) return { label, overdue: false, dueToday: true, note: "Due today" };
  if (days === 1) return { label, overdue: false, dueToday: false, note: "Due tomorrow" };
  return { label, overdue: false, dueToday: false, note: null };
}
