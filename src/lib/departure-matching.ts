/**
 * Breezeway departure clean → OwnerRez reservation matching (pure rules).
 *
 * Home + checkout date is the primary match. A clean scheduled a little after
 * checkout may match only when no other stay could own it. Anything with more
 * than one plausible reservation is refused — never guessed.
 */

export const DEPARTURE_CLEAN_TYPES_KEY = "departure_clean_task_types";

/** Real Breezeway housekeeping templates that are departure/turnover cleans (seen in Resolve data, Oct 2026). */
export const DEFAULT_DEPARTURE_CLEAN_NAMES = [
  "ARHA Departure Clean (Updated)",
  "Non- OKC ARHA Departure Clean (Updated)",
  "ARHA Departure Clean",
];

/** How many days after checkout a clean may still be the departure clean. */
export const DEFAULT_LATE_DAYS = 2;

export type MatchConfig = { names: string[]; lateDays: number };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function readMatchConfig(value: unknown): MatchConfig {
  const v = (value ?? {}) as { names?: unknown; late_days?: unknown };
  const names = Array.isArray(v.names) && v.names.every((n) => typeof n === "string") && v.names.length
    ? (v.names as string[]) : DEFAULT_DEPARTURE_CLEAN_NAMES;
  const late = typeof v.late_days === "number" && v.late_days >= 0 && v.late_days <= 7 ? v.late_days : DEFAULT_LATE_DAYS;
  return { names, lateDays: late };
}

export function isDepartureClean(department: string | null | undefined, name: string | null | undefined, cfg: MatchConfig) {
  if (department !== "housekeeping") return false;
  const n = norm(name);
  return cfg.names.some((x) => norm(x) === n);
}

export const DONE_STATUSES = ["finished", "approved", "closed"];
export const isDone = (status: string | null | undefined) => DONE_STATUSES.includes((status ?? "").toLowerCase());

export type MatchState =
  | "matched"
  | "no_reservation"
  | "multiple_reservations"
  | "not_departure"
  | "already_linked"
  | "missing_data";

export const MATCH_STATE_LABEL: Record<MatchState, string> = {
  matched: "Matched",
  no_reservation: "No matching reservation",
  multiple_reservations: "Multiple possible reservations",
  not_departure: "Not a departure clean",
  already_linked: "Already linked",
  missing_data: "Missing required data",
};

export type CleanInput = {
  id: string;
  task_id: number | null;
  property_id: string | null;
  ownerrez_property_id: string | null;
  department: string | null;
  name: string | null;
  status: string | null;
  scheduled_date: string | null; // YYYY-MM-DD
};

export type BookingInput = {
  id: string;
  property_id: string; // OwnerRez property id
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
  guest_name?: string | null;
  code?: string | null;
  listing_site?: string | null;
};

export type MatchResult = {
  clean_id: string;
  state: MatchState;
  booking_id: string | null;
  checkout_date: string | null;
  method: "same_day" | "late_clean" | "manual" | null;
  confidence: "high" | "medium" | null;
  reason: string;
  candidate_ids: string[];
};

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Matches one finished departure clean against its home's stays. */
export function matchClean(clean: CleanInput, bookings: BookingInput[], cfg: MatchConfig, today: string): MatchResult {
  const base = { clean_id: clean.id, booking_id: null, checkout_date: null, method: null, confidence: null, candidate_ids: [] as string[] };
  if (!isDepartureClean(clean.department, clean.name, cfg))
    return { ...base, state: "not_departure", reason: `“${clean.name ?? "Unnamed"}” is not a departure clean type` };
  const missing = [
    !clean.property_id && "home",
    !clean.ownerrez_property_id && "OwnerRez listing",
    !clean.scheduled_date && "clean date",
  ].filter(Boolean);
  if (missing.length) return { ...base, state: "missing_data", reason: `Missing ${missing.join(", ")}` };
  const svc = clean.scheduled_date!;
  const home = bookings.filter((b) => b.property_id === clean.ownerrez_property_id);

  const sameDay = home.filter((b) => b.departure === svc);
  if (sameDay.length > 1)
    return { ...base, state: "multiple_reservations", candidate_ids: sameDay.map((b) => b.id), reason: `${sameDay.length} stays check out ${svc}` };
  let pick: BookingInput | null = sameDay[0] ?? null;
  let method: MatchResult["method"] = pick ? "same_day" : null;

  if (!pick) {
    // A later clean: checkout up to N days earlier, and nobody stayed in between.
    const window = home.filter((b) => {
      const d = dayDiff(b.departure, svc);
      return d > 0 && d <= cfg.lateDays;
    });
    const clear = window.filter((b) => !home.some((o) => o.id !== b.id && o.arrival >= b.departure && o.arrival < svc));
    if (clear.length > 1)
      return { ...base, state: "multiple_reservations", candidate_ids: clear.map((b) => b.id), reason: `${clear.length} stays checked out within ${cfg.lateDays} days before the clean` };
    if (window.length && !clear.length)
      return { ...base, state: "no_reservation", candidate_ids: window.map((b) => b.id), reason: "Another guest arrived between checkout and the clean" };
    pick = clear[0] ?? null;
    method = pick ? "late_clean" : null;
  }
  if (!pick) return { ...base, state: "no_reservation", reason: `No stay checks out on ${svc} or up to ${cfg.lateDays} days before` };
  if (pick.departure > today)
    return { ...base, state: "no_reservation", candidate_ids: [pick.id], reason: "The matching stay has not ended yet" };
  const late = method === "late_clean" ? dayDiff(pick.departure, svc) : 0;
  return {
    ...base,
    state: "matched",
    booking_id: pick.id,
    checkout_date: pick.departure,
    method,
    confidence: method === "same_day" ? "high" : "medium",
    candidate_ids: [pick.id],
    reason: method === "same_day"
      ? "Same home, clean date = checkout date"
      : `Same home, clean ${late} day${late === 1 ? "" : "s"} after checkout, no stay in between`,
  };
}

/**
 * Matches a batch and enforces one designated clean per reservation: the
 * earliest clean (then lowest task id) keeps the match; other cleans for the
 * same stay become "Already linked". Existing links (manual or saved) win.
 */
export function matchAll(
  cleans: CleanInput[],
  bookings: BookingInput[],
  cfg: MatchConfig,
  today: string,
  existing: Map<string, string> = new Map(), // booking id → clean id already holding it
): MatchResult[] {
  const results = cleans.map((c) => matchClean(c, bookings, cfg, today));
  const byClean = new Map(cleans.map((c) => [c.id, c]));
  const groups = new Map<string, MatchResult[]>();
  for (const r of results) if (r.state === "matched" && r.booking_id) groups.set(r.booking_id, [...(groups.get(r.booking_id) ?? []), r]);
  for (const [bookingId, rs] of groups) {
    const holder = existing.get(bookingId);
    const sorted = [...rs].sort((a, b) => {
      const ca = byClean.get(a.clean_id)!, cb = byClean.get(b.clean_id)!;
      return (ca.scheduled_date ?? "").localeCompare(cb.scheduled_date ?? "") || (ca.task_id ?? 0) - (cb.task_id ?? 0);
    });
    const keeper = holder ?? sorted[0]!.clean_id;
    for (const r of rs) {
      if (r.clean_id === keeper) continue;
      r.state = "already_linked";
      r.reason = "Another departure clean already holds this reservation";
    }
  }
  return results;
}
