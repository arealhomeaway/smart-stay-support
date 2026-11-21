/**
 * Pace emails held after a correction (Nov 21). Browser-safe, pure.
 *
 * When the team or a data fix changes a homeowner's counted hours, the program's
 * pace_emails_held_until is set to 7 days later by the database. While it is in the
 * future the five-minute pass sends none of the pace-type nudges below; celebration
 * and final-days notices still go, and team follow-ups still run.
 */

/** The owner notice kinds a pace hold stops. */
export const PACE_HOLD_KINDS = [
  "progress_pace",
  "progress_checkpoint",
  "progress_milestone",
  "progress_quiet",
] as const;

export const PACE_HOLD_DAYS = 7;

export function paceHoldActive(heldUntil: string | null | undefined, now: number = Date.now()): boolean {
  if (!heldUntil) return false;
  const t = Date.parse(heldUntil);
  return Number.isFinite(t) && t > now;
}

/** Drops the held kinds while the hold is on; everything else passes through unchanged. */
export function withoutHeldPaceAlerts<T extends { alertKind: string }>(
  candidates: T[],
  heldUntil: string | null | undefined,
  now: number = Date.now(),
): T[] {
  if (!paceHoldActive(heldUntil, now)) return candidates;
  const held = new Set<string>(PACE_HOLD_KINDS);
  return candidates.filter((c) => !held.has(c.alertKind));
}

/** "Nov 28" in Central time. */
export function paceHoldResumeDate(heldUntil: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  }).format(new Date(heldUntil));
}

/** The one line the team sees during a hold, or null when there is none. */
export function paceHoldLine(heldUntil: string | null | undefined, now: number = Date.now()): string | null {
  if (!heldUntil || !paceHoldActive(heldUntil, now)) return null;
  return `Hours corrected. Pace emails resume ${paceHoldResumeDate(heldUntil)}.`;
}

/** The pace email body: her real numbers, encouraging, nothing about tax. */
export function paceEmailBody(loggedHours: number, recommendedHours: number): string {
  return `You have ${loggedHours} hours logged. The recommended pace for this point in your program is ${recommendedHours} hours. If you have done anything you haven't logged yet, now is a good time to add it.`;
}
