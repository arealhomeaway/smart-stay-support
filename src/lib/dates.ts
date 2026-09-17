/**
 * One date and time vocabulary for everything a person reads in Resolve.
 *
 * Calendar dates are U.S. standard (MM/DD/YYYY). Times are 12-hour with an
 * upper-case meridiem. ISO strings are for machines, never for the screen.
 */

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 09/03/2026 */
export function usDate(value: string | number | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Stored YYYY-MM-DD calendar date; never convert its day to the viewer's timezone. */
export function usCalendarDate(value: string | null | undefined, fallback = "—"): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = toDate(value);
  if (!d || d.toISOString().slice(0, 10) !== value) return fallback;
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

/** 10:00 PM */
export function usTime(value: string | number | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** 09/03/2026 · 10:00 PM */
export function usDateTime(
  value: string | number | Date | null | undefined,
  fallback = "—",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${usDate(d)} · ${usTime(d)}`;
}

/** 09/03 — compact form for timelines and dense rows. */
export function usShortDate(
  value: string | number | Date | null | undefined,
  fallback = "—",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit" }).format(d);
}
