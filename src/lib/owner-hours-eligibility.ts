/**
 * When a homeowner may log participation hours. Mirrors the server rule
 * (DB `private.lock_owner_time_program` / `owner_hours_eligibility`), which is
 * the authority; this copy only explains the state on screen.
 *
 * Business date = the America/Chicago calendar day, never browser-local or UTC.
 */

export const BUSINESS_TIME_ZONE = "America/Chicago";

/** YYYY-MM-DD for the business calendar day at `now`. */
export function businessToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type HoursHome = {
  inclusionStatus?: string | null;
  closingConfirmed?: boolean | null;
  closingDate?: string | null;
};

export type HoursEligibility =
  | { eligible: true; openedOn: string }
  | { eligible: false; reason: "closed" | "paused" | "closing_future" | "no_confirmed_closing"; closingOn?: string };

export function ownerHoursEligibility(
  program: { status: string; completedAt?: string | null },
  homes: HoursHome[],
  today: string = businessToday(),
): HoursEligibility {
  if (program.completedAt || program.status === "completed") return { eligible: false, reason: "closed" };
  if (program.status === "paused") return { eligible: false, reason: "paused" };
  const confirmed = homes
    .filter((h) => h.inclusionStatus === "included" && h.closingConfirmed && h.closingDate)
    .map((h) => h.closingDate as string)
    .sort();
  const arrived = confirmed.filter((d) => d <= today);
  if (arrived.length) return { eligible: true, openedOn: arrived[0]! };
  const next = confirmed.find((d) => d > today);
  if (next) return { eligible: false, reason: "closing_future", closingOn: next };
  return { eligible: false, reason: "no_confirmed_closing" };
}

/** Home is taggable on an entry once its own confirmed closing has arrived. */
export function homeClosingArrived(h: HoursHome, today: string = businessToday()) {
  return h.inclusionStatus === "included" && !!h.closingConfirmed && !!h.closingDate && h.closingDate <= today;
}

export function hoursBlockedMessage(e: HoursEligibility, formatDate: (d: string) => string): string | null {
  if (e.eligible) return null;
  switch (e.reason) {
    case "closed":
      return "Your program closed on December 31, so no further hours can be added.";
    case "paused":
      return "Your program is paused. Contact your ARHA team to resume logging.";
    case "closing_future":
      return `Your portal is ready to explore. Hour logging opens on ${formatDate(e.closingOn!)}, your confirmed closing date.`;
    default:
      return "Your portal is ready to explore. Hour logging opens once your property's actual closing date is confirmed and that date has arrived.";
  }
}
