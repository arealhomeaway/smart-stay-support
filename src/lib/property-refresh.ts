/** Pure rule for the nightly refresh of property info and photos from OwnerRez. */

export const PROPERTY_REFRESH_HOUR_CENTRAL = 3;

function centralHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(d),
  );
}

/** Runs once in the 3 a.m. Central hour, and never twice within 20 hours. */
export function nightlyPropertyRefreshDue(now: Date, lastRunAt: string | null): boolean {
  if (centralHour(now) !== PROPERTY_REFRESH_HOUR_CENTRAL) return false;
  if (!lastRunAt) return true;
  return now.getTime() - new Date(lastRunAt).getTime() >= 20 * 3600_000;
}
