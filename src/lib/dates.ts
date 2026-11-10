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
export function usDate(value: string | number | Date | null | undefined, fallback = "Not set"): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return usCalendarDate(value, fallback);
  const d = toDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Stored YYYY-MM-DD calendar date; never convert its day to the viewer's timezone. */
export function usCalendarDate(value: string | null | undefined, fallback = "Not set"): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = toDate(value);
  if (!d || d.toISOString().slice(0, 10) !== value) return fallback;
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

/** 10:00 PM */
export function usTime(value: string | number | Date | null | undefined, fallback = "Not set"): string {
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
  fallback = "Not set",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${usDate(d)} · ${usTime(d)}`;
}

/** 09/03 — compact form for timelines and dense rows. */
export function usShortDate(
  value: string | number | Date | null | undefined,
  fallback = "Not set",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit" }).format(d);
}

/* ---------- Central time (Emily, Nov 10: hand off form, next step due time, My shift) ---------- */

const CENTRAL = "America/Chicago";
export const CENTRAL_SUFFIX = "Central time";

/** "11/12/2026 · 3:00 PM Central time", whatever the viewer's own clock is. */
export function centralDateTime(value: string | number | Date | null | undefined, fallback = "Not set"): string {
  const d = toDate(value);
  if (!d) return fallback;
  const day = new Intl.DateTimeFormat("en-US", { timeZone: CENTRAL, month: "2-digit", day: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: CENTRAL, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${day} · ${time} ${CENTRAL_SUFFIX}`;
}

function centralParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute") };
}

/** A "YYYY-MM-DDTHH:MM" form value read as Central wall clock time, as an ISO instant. */
export function centralInputToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, da, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  // Two passes settle the offset, including the days the clocks change.
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = centralParts(new Date(guess));
    const seen = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    guess += wall - seen;
  }
  return new Date(guess).toISOString();
}
