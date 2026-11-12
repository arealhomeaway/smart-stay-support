/** When the nightly PID copy runs (pure). */

export const PID_SYNC_HOUR_CENTRAL = 2;
/** A run that has not finished after this long is closed as failed. */
export const PID_SYNC_STALE_MS = 6 * 3600_000;
/** Each pass of the five-minute job works this long at most, then the next pass continues. */
export const PID_SYNC_PASS_BUDGET_MS = 45_000;

export function centralHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(d));
}

/** The Central calendar date, YYYY-MM-DD (the run's as-of date). */
export function centralDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** A new run starts once in the 2 AM Central hour, never twice within 20 hours. */
export function pidSyncDue(now: Date, lastStartedAt: string | null): boolean {
  if (centralHour(now) !== PID_SYNC_HOUR_CENTRAL) return false;
  if (!lastStartedAt) return true;
  return now.getTime() - new Date(lastStartedAt).getTime() >= 20 * 3600_000;
}

export type LastRun = { status: string; created_at: string } | null;
export type PassAction = "continue" | "close_stale" | "start" | "wait";

/** What a pass of the five-minute job does with the latest run. */
export function pidSyncPassAction(now: Date, last: LastRun): PassAction {
  if (last && last.status === "processing") {
    return now.getTime() - new Date(last.created_at).getTime() > PID_SYNC_STALE_MS ? "close_stale" : "continue";
  }
  return pidSyncDue(now, last?.created_at ?? null) ? "start" : "wait";
}
