/**
 * Arrival check queue and Arrival readiness (Build 12; Emily, Nov 10; register BN4, BN10;
 * spec docs/specs/arrival-check.md). Pure and browser-safe: words, times, the Team Queue
 * due line, the Databases list rules and the rows the hourly sync hands to the database.
 * Every decision (who gets a check, the deadline, the result, the alert) is made once, in the
 * database (migration 0325, docs/pending/arrival-check).
 */

export const ARRIVAL_EXTERNAL_PREFIX = "arrival:";
export const ARRIVAL_ISSUE_PREFIX = "arrival-issue:";

export function isArrivalCheckTicket(t: { external_source?: string | null; external_id?: string | null } | null | undefined) {
  return (t?.external_source ?? "").toLowerCase() === "ownerrez" && (t?.external_id ?? "").startsWith(ARRIVAL_EXTERNAL_PREFIX);
}

/** A test arrival check ticket (made from Integrations, never counted). */
export function isArrivalTestTicket(t: { is_demo?: boolean | null; external_source?: string | null; external_id?: string | null } | null | undefined) {
  return Boolean(t?.is_demo) && isArrivalCheckTicket(t) && (t?.external_id ?? "").startsWith(`${ARRIVAL_EXTERNAL_PREFIX}test-`);
}

/**
 * Every arrival time is shown in Central time (spec item 2), worked out from the instant the
 * database computed in the home's own zone. The zone argument is kept for callers but not used.
 */
export function arrivalTime(iso: string | null | undefined, _tz?: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** Team Queue and Home: the due time (Central), red inside the last 30 minutes before the deadline. */
export function arrivalDueLine(deadlineIso: string | null | undefined, tz: string | null | undefined, now: Date | number = Date.now()) {
  if (!deadlineIso) return { text: "", urgent: false };
  const t = typeof now === "number" ? now : now.getTime();
  const urgent = t >= new Date(deadlineIso).getTime() - 30 * 60_000;
  return { text: `Due ${arrivalTime(deadlineIso, tz)}`, urgent };
}

export type ArrivalResult = "on_time" | "late" | "missed";
export const ARRIVAL_RESULT_LABEL: Record<ArrivalResult | "open" | "cancelled", string> = {
  on_time: "On time",
  late: "Late",
  missed: "Missed",
  open: "Not done yet",
  cancelled: "Cancelled",
};

export const ARRIVAL_COPY = {
  panelTitle: "Arrival check",
  guestArrives: "Guest arrives",
  checkBy: "Check by",
  guests: (n: number | null | undefined) => (n ? `${n} ${n === 1 ? "guest" : "guests"}` : "Guests not given"),
  pets: (n: number | null | undefined) => (n ? `${n} ${n === 1 ? "pet" : "pets"}` : "No pets"),
  ownerStay: "Owner stay",
  lateBooking: "Booked less than 2 hours before check in",
  test: "Test",
  stepLock: "1. Smart lock",
  lockQuestion: "Does the lock show connected?",
  lockYes: "Connected",
  lockNo: "Not connected",
  lockNote: "What is wrong with the lock",
  lockBrand: (b: string) => `Lock: ${b}`,
  lockUnknown: "Lock brand not on the home record",
  stepWorkOrders: "2. Open Breezeway work orders",
  noWorkOrders: "No open Breezeway work orders for this home.",
  reviewed: "I reviewed the open work orders",
  stepOutcome: "3. The home",
  ready: "Ready for the guest",
  issue: "Issue found",
  issueText: "What is the issue",
  backupPlan: "The safe backup plan",
  save: "Complete check",
  saving: "Saving",
  saved: "Arrival check saved.",
  done: (who: string, when: string) => `Done by ${who} at ${when}`,
  issueTicket: "Open the issue ticket",
  readOnly: "View only.",
  homePage: "Open the home",
} as const;

/** What the hourly OwnerRez sync hands to the database: guest first name only, nothing else private. */
export type SyncBooking = {
  id: number | string;
  property_id?: number | string;
  arrival?: string;
  departure?: string;
  check_in?: string | null;
  status?: string | null;
  type?: string | null;
  is_block?: boolean | null;
  title?: string | null;
  guest_id?: number | string | null;
  guest_name?: string | null;
  guest?: { id?: number | string | null; first_name?: string | null } | null;
  adults?: number | null;
  children?: number | null;
  infants?: number | null;
  pets?: number | null;
  booked_utc?: string | null;
  created_utc?: string | null;
};

export function arrivalIngestRow(b: SyncBooking) {
  const first = b.guest?.first_name?.trim() || (b.guest_name ?? "").trim().split(/\s+/)[0] || null;
  return {
    id: String(b.id),
    property_id: b.property_id === undefined || b.property_id === null ? null : String(b.property_id),
    arrival: b.arrival ? b.arrival.slice(0, 10) : null,
    departure: b.departure ? b.departure.slice(0, 10) : null,
    check_in: b.check_in ?? null,
    status: b.status ?? null,
    type: b.type ?? null,
    is_block: Boolean(b.is_block),
    title: b.title ?? null,
    guest_id: b.guest_id ?? b.guest?.id ?? null,
    guest: first ? { first_name: first } : null,
    adults: b.adults ?? null,
    children: b.children ?? null,
    infants: b.infants ?? null,
    pets: b.pets ?? null,
    booked_utc: b.booked_utc ?? null,
    created_utc: b.created_utc ?? null,
  };
}

/** Databases, Arrival readiness: one row per check. */
export type ArrivalRow = {
  id: string;
  home_label: string;
  property_id: string | null;
  arrival_on: string;
  check_in_at: string;
  deadline_at: string;
  time_zone: string;
  team: string;
  status: "open" | "complete" | "cancelled";
  result: ArrivalResult | null;
  outcome: "ready" | "issue" | null;
  issue_text: string | null;
  backup_plan: string | null;
  completed_by: string | null;
  completed_at: string | null;
  ticket_id: string | null;
  late_booking: boolean;
  is_test: boolean;
  cleared_at: string | null;
};

export function arrivalResultLabel(r: Pick<ArrivalRow, "status" | "result">): string {
  if (r.status === "cancelled") return ARRIVAL_RESULT_LABEL.cancelled;
  return r.result ? ARRIVAL_RESULT_LABEL[r.result] : ARRIVAL_RESULT_LABEL.open;
}

export type ArrivalFilter = {
  term?: string | null;
  from?: string | null; // YYYY-MM-DD, arrival date
  to?: string | null;
  home?: string | null; // property id
  person?: string | null; // completed_by
  result?: "on_time" | "late" | "missed" | "open" | "cancelled" | null;
  team?: string | null;
};

export function filterArrivalRows(rows: ArrivalRow[], f: ArrivalFilter): ArrivalRow[] {
  return rows.filter((r) => {
    if (r.is_test && r.cleared_at) return false;
    const term = (f.term ?? "").trim().toLowerCase();
    if (term && !`${r.home_label} ${r.issue_text ?? ""} ${r.backup_plan ?? ""}`.toLowerCase().includes(term)) return false;
    if (f.from && r.arrival_on < f.from) return false;
    if (f.to && r.arrival_on > f.to) return false;
    if (f.home && r.property_id !== f.home) return false;
    if (f.person && r.completed_by !== f.person) return false;
    if (f.team && r.team !== f.team) return false;
    if (f.result) {
      if (f.result === "cancelled") return r.status === "cancelled";
      if (f.result === "open") return r.status === "open" && !r.result;
      return r.result === f.result && r.status !== "cancelled";
    }
    return true;
  });
}

/**
 * Totals of what is shown: checks, on time (count and share), late, missed, issues flagged.
 * Cancelled reservations, late bookings and test checks never count.
 */
export function arrivalTotals(rows: ArrivalRow[]) {
  const counted = rows.filter((r) => r.status !== "cancelled" && !r.late_booking && !r.is_test);
  const onTime = counted.filter((r) => r.result === "on_time").length;
  const late = counted.filter((r) => r.result === "late").length;
  const missed = counted.filter((r) => r.result === "missed").length;
  const decided = onTime + late + missed;
  return {
    arrivals: counted.length,
    onTime,
    onTimeShare: decided ? Math.round((onTime / decided) * 1000) / 10 : null,
    late,
    missed,
    issues: counted.filter((r) => r.outcome === "issue").length,
  };
}
