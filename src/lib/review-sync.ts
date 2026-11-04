/** Pure rules for the nightly OwnerRez review import. */

export const REVIEW_SYNC_HOUR_CENTRAL = 2;

function centralHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(d));
}

/** Runs once in the 2 a.m. Central hour, and never twice within 20 hours. */
export function nightlyReviewSyncDue(now: Date, lastRunAt: string | null): boolean {
  if (centralHour(now) !== REVIEW_SYNC_HOUR_CENTRAL) return false;
  if (!lastRunAt) return true;
  return now.getTime() - new Date(lastRunAt).getTime() >= 20 * 3600_000;
}

/** Looks back from the last good run with a 2 day overlap; 60 days if none. */
export function reviewSyncSince(now: Date, lastOkAt: string | null): string {
  const base = lastOkAt ? new Date(lastOkAt).getTime() - 2 * 86400_000 : now.getTime() - 60 * 86400_000;
  return new Date(base).toISOString();
}
