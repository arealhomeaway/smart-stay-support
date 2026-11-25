/**
 * Today's date (YYYY-MM-DD) in America/Chicago, the same day the database's
 * private.business_today() uses. Browser and server safe.
 */
export function centralToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from today (Central) to a YYYY-MM-DD end date; never below zero. */
export function centralDaysUntil(endsOn: string | null | undefined, now: Date = new Date()): number {
  if (!endsOn || !/^\d{4}-\d{2}-\d{2}/.test(endsOn)) return 0;
  const today = Date.parse(`${centralToday(now)}T00:00:00Z`);
  const end = Date.parse(`${endsOn.slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((end - today) / 86_400_000));
}
