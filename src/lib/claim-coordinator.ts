/**
 * Claims Coordinator view rules (approved Nov 18). Pure: the filing deadline default,
 * how the deadline reads, the filing reminder, the one overdue alert and the line-item total.
 * The staged database trigger `claims_default_filing_deadline` mirrors defaultFilingDeadline.
 */

/** Days after checkout that Airbnb and Vrbo allow for filing. */
export const PLATFORM_FILING_DAYS = 14;
/** Days before the filing deadline that the one reminder goes out. */
export const FILING_REMINDER_DAYS = 3;
/** Days after the filing deadline that the one overdue alert goes out (the day after, Chicago). */
export const FILING_OVERDUE_DAYS_AFTER = 1;
/** deadline_source value written when Resolve set the deadline from checkout. */
export const PLATFORM_DEFAULT_SOURCE = "platform_default";
/** Stages before Submitted: the only ones a filing reminder can fire for. */
export const PRE_SUBMISSION_STAGES = ["potential", "gathering", "costing", "ready_to_submit"] as const;

export type FilingPlatform = "airbnb" | "vrbo" | null;

/** Airbnb or Vrbo from the booking source, falling back to the reservation channel. */
export function filingPlatform(bookingSource?: string | null, reservationChannel?: string | null): FilingPlatform {
  const s = `${(bookingSource ?? "").trim() || (reservationChannel ?? "")}`.toLowerCase();
  if (!s) return null;
  if (s.includes("airbnb") || s.includes("aircover")) return "airbnb";
  if (s.includes("vrbo") || s.includes("homeaway")) return "vrbo";
  return null;
}

function addDays(iso: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}

/** Checkout + 14 days for Airbnb and Vrbo; null for every other source. */
export function defaultFilingDeadline(checkout?: string | null, bookingSource?: string | null, reservationChannel?: string | null): string | null {
  if (!checkout || !filingPlatform(bookingSource, reservationChannel)) return null;
  return addDays(checkout, PLATFORM_FILING_DAYS);
}

export type DeadlineFacts = {
  deadline_on?: string | null;
  deadline_source?: string | null;
  deadline_verified?: boolean | null;
  stay_departure?: string | null;
  booking_source?: string | null;
  reservation_channel?: string | null;
};

/** A deadline counts as known when Resolve set it from Airbnb/Vrbo checkout or a manager confirmed it. */
export function deadlineKnown(c: DeadlineFacts): boolean {
  return !!c.deadline_on && (c.deadline_verified === true || c.deadline_source === PLATFORM_DEFAULT_SOURCE);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function plainDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const thisYear = new Date().getUTCFullYear();
  return `${MONTHS[m! - 1]} ${d}${y === thisYear ? "" : `, ${y}`}`;
}

/** How the deadline reads to a Coordinator: a plain date, or that it needs verification. */
export function deadlineLine(c: DeadlineFacts): string {
  if (deadlineKnown(c)) return `File by ${plainDate(c.deadline_on!)}`;
  const fallback = defaultFilingDeadline(c.stay_departure, c.booking_source, c.reservation_channel);
  if (fallback && !c.deadline_on) return `File by ${plainDate(fallback)}`;
  return "Deadline needs verification";
}

/** Today's date in Chicago as YYYY-MM-DD. */
export function chicagoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type ReminderFacts = DeadlineFacts & { stage: string; is_demo?: boolean | null };

/** The reminder window: from 3 days before the deadline (Chicago) until Submitted. */
export function filingReminderReached(c: ReminderFacts, now = new Date()): boolean {
  if (!(PRE_SUBMISSION_STAGES as readonly string[]).includes(c.stage)) return false;
  if (!deadlineKnown(c)) return false;
  return daysBetween(chicagoToday(now), c.deadline_on!) <= FILING_REMINDER_DAYS;
}

/**
 * Which filing alert is due today (Chicago), if any (Nov 23 rule). At most two per deadline date:
 * the reminder from 3 days before through the day before, and the overdue alert on the day after
 * only. Nothing on the deadline day itself, nothing after Submitted, nothing for a deadline that
 * still needs verification. The highlight on My claims stays filingReminderReached.
 */
export function filingAlertDue(c: ReminderFacts, now = new Date()): "reminder" | "overdue" | null {
  if (!(PRE_SUBMISSION_STAGES as readonly string[]).includes(c.stage)) return null;
  if (!deadlineKnown(c)) return null;
  const days = daysBetween(chicagoToday(now), c.deadline_on!);
  if (days >= 1 && days <= FILING_REMINDER_DAYS) return "reminder";
  if (days === -FILING_OVERDUE_DAYS_AFTER) return "overdue";
  return null;
}

/** Who gets the reminder: the claim owner, else the Operations Supervisor. */
export function reminderRecipient(assignedTo: string | null | undefined, supervisorId: string | null | undefined): string | null {
  return assignedTo || supervisorId || null;
}

/** One reminder per claim per deadline date: the key stored in the notice link. */
export function reminderLink(claimId: string, deadline: string): string {
  return `/claims/my-claims?claim=${claimId}&file_by=${deadline}`;
}

export type LineItem = { issue: string; amount_requested: number | string | null };
export function lineItemsTotal(items: LineItem[]): number {
  const cents = items.reduce((s, i) => s + Math.round(Number(i.amount_requested ?? 0) * 100), 0);
  return cents / 100;
}
