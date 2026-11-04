/**
 * Guest touch base auto-trigger rules (pure, browser-safe).
 *
 * One task per OwnerRez reservation of 4 or more nights, created on day 2 of
 * the stay (arrival day is day 1), Central time. Only stays arriving on or
 * after TOUCH_BASE_START_DATE qualify, so nothing is created for stays that
 * were already in progress or in the past when this rule started.
 */
export const TOUCH_BASE_START_DATE = "2026-11-05";
export const TOUCH_BASE_MIN_NIGHTS = 4;
export const TOUCH_BASE_TZ = "America/Chicago";
/** Due by 5 p.m. Central on day 2. */
export const TOUCH_BASE_DUE_HOUR = 17;
export const TOUCH_BASE_CANCEL_NOTE =
  "Closed automatically: this reservation was cancelled in OwnerRez, so no touch base is needed.";

export type TouchBaseBooking = {
  id: number | string;
  arrival: string;
  departure: string;
  status?: string | null;
  is_block?: boolean | null;
};

export function touchBaseEventKey(bookingId: number | string) {
  return `touchbase:${bookingId}`;
}

/** yyyy-mm-dd of `now` on the Central wall clock. */
export function centralDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TOUCH_BASE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function stayNights(arrival: string, departure: string): number {
  const a = Date.parse(`${arrival.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${departure.slice(0, 10)}T12:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function isCancelledBooking(b: Pick<TouchBaseBooking, "status">): boolean {
  return (b.status ?? "").toLowerCase().startsWith("cancel");
}

/** Whether this stay is the kind that gets a touch base at all. */
export function stayQualifies(b: TouchBaseBooking): boolean {
  if (b.is_block) return false;
  if (isCancelledBooking(b)) return false;
  const arrival = b.arrival?.slice(0, 10);
  if (!arrival || !b.departure) return false;
  if (arrival < TOUCH_BASE_START_DATE) return false;
  return stayNights(arrival, b.departure) >= TOUCH_BASE_MIN_NIGHTS;
}

/** Day 2 of the stay (arrival day is day 1). */
export function touchBaseDay(arrival: string): string {
  return addDays(arrival.slice(0, 10), 1);
}

/** Create now only from day 2 until the guest leaves. */
export function touchBaseDueToCreate(b: TouchBaseBooking, now: Date): boolean {
  if (!stayQualifies(b)) return false;
  const today = centralDate(now);
  return today >= touchBaseDay(b.arrival) && today < b.departure.slice(0, 10);
}

/** UTC instant for a Central wall-clock date and hour (handles daylight saving). */
export function centralWallTime(ymd: string, hour: number): Date {
  for (const offset of [5, 6]) {
    const guess = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00Z`);
    guess.setUTCHours(guess.getUTCHours() + offset);
    const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TOUCH_BASE_TZ, hour: "numeric", hourCycle: "h23" }).format(guess));
    if (h === hour && centralDate(guess) === ymd) return guess;
  }
  const fallback = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00Z`);
  fallback.setUTCHours(fallback.getUTCHours() + 6);
  return fallback;
}

export function touchBaseDueAt(arrival: string): Date {
  return centralWallTime(touchBaseDay(arrival), TOUCH_BASE_DUE_HOUR);
}

/** The sync runs at most once an hour from the five-minute job. */
export function touchBaseSyncDue(now: Date, lastRunIso: string | null): boolean {
  if (!lastRunIso) return true;
  return now.getTime() - Date.parse(lastRunIso) >= 55 * 60 * 1000;
}
