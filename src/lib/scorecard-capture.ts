/**
 * Scorecard capture: browser-safe rules and wording. Capture only, no scoring.
 * The database repeats every role and time rule (docs/pending/scorecard-capture/).
 */

export const SCORECARD_KINDS = [
  "arrival_readiness",
  "queue_sweep",
  "coaching_cycle",
  "weekly_submission",
  "corrective_commitment",
  "finance_packet",
] as const;
export type ScorecardKind = (typeof SCORECARD_KINDS)[number];

export const CAPTURE_COPY = {
  readyButton: "Ready for arrival",
  readyThanks: "Thank you. The home is marked ready.",
  readyTitle: "Next arrival",
  coachingButton: "Record a coaching conversation",
  coachingThanks: "Thank you. The conversation is saved.",
  financeButton: "Finance packet delivered",
  financeThanks: "Thank you. The delivery is saved.",
  commitButton: "Add a commitment",
  commitThanks: "Thank you. The commitment is saved.",
  approveButton: "Approve",
  approveThanks: "Thank you. Your approval is saved.",
  correctionButton: "Add a correction",
  correctionThanks: "Thank you. The correction is saved.",
  archiveButton: "Archive ticket",
  archiveThanks: "Ticket archived. Its history is kept.",
  restoreButton: "Restore ticket",
  restoreThanks: "Ticket restored.",
  channelsThanks: "Saved. Thank you.",
  notReady: "This is not ready yet. Nothing was saved.",
} as const;

const TZ = "America/Chicago";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Central weekday (0 = Sunday) and date (YYYY-MM-DD). */
export function centralDay(now: Date): { weekday: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { weekday: WEEKDAYS.indexOf(get("weekday")), date: `${get("year")}-${get("month")}-${get("day")}` };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Finance packet delivered" shows from Thursday through Sunday, Central time. */
export function financePacketVisible(now: Date): boolean {
  const { weekday } = centralDay(now);
  return weekday === 4 || weekday === 5 || weekday === 6 || weekday === 0;
}

/** The Friday of the current Monday to Sunday week, Central time. */
export function financeWeekEnding(now: Date): string {
  const { weekday, date } = centralDay(now);
  const fromMonday = (weekday + 6) % 7; // Mon 0 ... Sun 6
  return addDays(date, 4 - fromMonday);
}

/** A guest issue ticket: guest category, a guest work type, or linked to a guest review. */
export function isGuestIssueTicket(t: {
  category?: string | null;
  linked_feedback_id?: string | null;
  work_type_category?: string | null;
}): boolean {
  return t.category === "guest" || t.work_type_category === "guest" || Boolean(t.linked_feedback_id);
}

export type ScorecardRoles = {
  supervisor: boolean;
  director: boolean;
  coo: boolean;
  /** Corrective commitments, finance packet, rating channels. */
  leads: boolean;
};

/** Mirrors private.sc_is_ops_supervisor / sc_is_ops_director / sc_is_coo. Roles only. */
export function scorecardRoles(input: {
  isAdmin: boolean;
  supervisorRole: boolean;
  directorRole: boolean;
  cooRole: boolean;
}): ScorecardRoles {
  const director = input.isAdmin || input.directorRole;
  return {
    supervisor: input.supervisorRole,
    director,
    coo: input.cooRole,
    leads: input.supervisorRole || director,
  };
}

export type CapturedRecord = {
  ticket_id: string | null;
  about_imported_ticket: boolean;
  is_demo: boolean;
};

/** Records that may count later: no demo, no Notion imports, no archived tickets. */
export function countableRecords<T extends CapturedRecord>(rows: T[], archivedTicketIds: ReadonlySet<string>): T[] {
  return rows.filter(
    (r) => !r.is_demo && !r.about_imported_ticket && !(r.ticket_id && archivedTicketIds.has(r.ticket_id)),
  );
}

export function archiveReasonProblem(reason: string): string | null {
  const len = reason.trim().length;
  if (len < 3) return "Give a short reason for archiving.";
  if (len > 500) return "Keep the reason under 500 characters.";
  return null;
}

/** Archive: Admin or a Supervisor. Restore: Admin only. Nobody deletes. */
export function canArchiveTicket(r: { isSupervisor: boolean; supervisorRole: boolean }): boolean {
  return r.isSupervisor || r.supervisorRole;
}
export function canRestoreTicket(r: { isAdmin: boolean }): boolean {
  return r.isAdmin;
}

export const RATING_CHANNELS = [
  { value: "airbnb", label: "Airbnb" },
  { value: "vrbo", label: "Vrbo" },
  { value: "booking_com", label: "Booking.com" },
  { value: "direct", label: "Direct" },
  { value: "google", label: "Google" },
] as const;
export const DEFAULT_RATING_CHANNELS = ["airbnb", "vrbo"];
export const RATING_CHANNELS_KEY = "guest_rating_channels";

export function readRatingChannels(value: unknown): string[] {
  const list = (value as { channels?: unknown } | null)?.channels;
  if (!Array.isArray(list)) return [...DEFAULT_RATING_CHANNELS];
  const known = new Set<string>(RATING_CHANNELS.map((c) => c.value));
  const clean = list.filter((c): c is string => typeof c === "string" && known.has(c));
  return clean.length ? clean : [...DEFAULT_RATING_CHANNELS];
}

/** A database change that is staged but not applied yet reads as "not ready". */
export function isNotReadyError(e: { message?: string; code?: string } | null | undefined): boolean {
  if (!e) return false;
  if (e.code === "PGRST202" || e.code === "PGRST205" || e.code === "42883" || e.code === "42P01") return true;
  return /could not find the (function|table)|does not exist|schema cache/i.test(e.message ?? "");
}

/** Commitments with their COO approval line, newest first. */
export type CommitmentRow = {
  id: string;
  recorded_at: string;
  recorded_by: string;
  note: string | null;
  refers_to: string | null;
  details: { action?: string; due_on?: string } | null;
};
export function pairCommitments(rows: CommitmentRow[]) {
  const approvals = new Map<string, CommitmentRow>();
  for (const r of rows) if (r.details?.action === "coo_approval" && r.refers_to) approvals.set(r.refers_to, r);
  return rows
    .filter((r) => r.details?.action === "commitment")
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .map((c) => ({ ...c, approval: approvals.get(c.id) ?? null }));
}
