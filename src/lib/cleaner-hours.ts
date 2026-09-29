/**
 * STR Cleaner Hours Safeguard — browser-safe labels and pure helpers.
 *
 * Vocabulary rule: the number is "Attributed Cleaner Time". It is never called
 * hours worked, and nothing here draws a tax or qualification conclusion.
 */

export const ATTRIBUTED_TIME_LABEL = "Attributed Cleaner Time";

export const METHOD_LABEL: Record<string, string> = {
  single_individual_assignee: "Single cleaner — full elapsed Task time",
  multi_assignee_full_elapsed: "Multiple cleaners — full elapsed Task time to each",
  manual_correction: "Manually corrected",
  manual_entry: "Off-Breezeway clean (manual)",
  company_only_needs_review: "Company account only — needs review",
  invalid_duration_needs_review: "No usable elapsed time — needs review",
  company_account_not_counted: "Company account alongside named cleaners — not counted",
  provisional_duration: "Provisional standard duration — needs review",
  provisional_cap: "Provisional cap (standard + 2 h) — needs review",
};

export const REVIEW_KIND_LABEL: Record<string, string> = {
  company_only: "Company account only",
  unclassified_assignee: "Unclassified Breezeway account",
  possible_duplicate_identity: "Possible duplicate identity",
  zero_duration: "Zero or missing elapsed time",
  short_duration: "Elapsed time under 10 minutes",
  long_duration: "Elapsed time over 8 hours",
  unmatched_property: "Property not matched",
  manual_entry: "Off-Breezeway clean entered manually",
  source_changed_after_correction: "Breezeway changed after a correction",
  source_missing: "Task no longer returned by Breezeway",
  company_identity_needed: "Company login — identify the individual cleaner(s)",
  override_request: "Override requested — leadership review required",
  native_assignment_alert: "Assigned in Breezeway outside the safeguard",
  threshold_reached: "Safeguard state reached",
};

export const CLASSIFICATION_LABEL: Record<string, string> = {
  unclassified: "Not yet classified",
  individual: "Individual",
  company: "Company / Vendor",
  duplicate: "Duplicate of existing worker",
  unknown: "Unknown — needs research",
};

export const REVIEW_STATE_LABEL: Record<string, string> = {
  auto: "Automatic",
  reviewed: "Reviewed",
  needs_review: "Needs review",
  not_counted: "Not counted",
};

/** Minutes → "3 h 05 m". Null stays visibly unknown, never zero. */
export function formatMinutes(minutes: number | string | null | undefined): string {
  if (minutes == null || minutes === "") return "Unknown";
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m)) return "Unknown";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h ${String(r).padStart(2, "0")} m` : `${r} m`;
}

export function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null) return "Missing";
  return formatMinutes(seconds / 60);
}

export type SummaryRow = {
  year: number;
  property_id: string | null;
  worker_id: string | null;
  unlinked_person_id: number | null;
  worker_name: string;
  worker_type: string;
  attributed_minutes: number | string | null;
  cleans: number;
  reviewed_entries: number;
  unreviewed_entries: number;
  unknown_time_entries: number;
  last_clean: string | null;
  lowest_confidence: string;
};

export function workerKey(r: Pick<SummaryRow, "worker_id" | "unlinked_person_id" | "worker_name">) {
  return r.worker_id ?? (r.unlinked_person_id != null ? `bz:${r.unlinked_person_id}` : `name:${r.worker_name}`);
}

export type Group = {
  key: string;
  rows: SummaryRow[];
  minutes: number;
  cleans: number;
  unreviewed: number;
  unknown: number;
  last: string | null;
};

/** Groups summary rows by property or by worker; totals ignore unknown time rather than zero it. */
export function groupSummary(rows: SummaryRow[], by: "property" | "worker"): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = by === "property" ? (r.property_id ?? "none") : workerKey(r);
    const g = map.get(key) ?? { key, rows: [], minutes: 0, cleans: 0, unreviewed: 0, unknown: 0, last: null };
    g.rows.push(r);
    g.minutes += Number(r.attributed_minutes ?? 0);
    g.cleans += Number(r.cleans);
    g.unreviewed += Number(r.unreviewed_entries);
    g.unknown += Number(r.unknown_time_entries);
    if (r.last_clean && (!g.last || r.last_clean > g.last)) g.last = r.last_clean;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

// ---------------------------------------------------------------------------
// Phase 2 — staged safeguard states. The rule itself lives in the database
// (private.cleaner_safeguard_state); these are display labels only.

export type SafeguardState = "normal" | "monitor" | "warning" | "restricted" | "hard_block" | "identity_required" | "not_tracked";

export const STATE_LABEL: Record<SafeguardState, string> = {
  normal: "Normal",
  monitor: "Monitor",
  warning: "Warning",
  restricted: "Restricted",
  hard_block: "Hard Block",
  identity_required: "Identify cleaner",
  not_tracked: "Not tracked",
};

export const STATE_TONE: Record<SafeguardState, "neutral" | "review" | "attention" | "critical" | "positive"> = {
  normal: "positive",
  monitor: "review",
  warning: "attention",
  restricted: "critical",
  hard_block: "critical",
  identity_required: "attention",
  not_tracked: "neutral",
};

/** Badge classes on semantic tokens (Hard Block is the solid crimson). */
export const STATE_BADGE: Record<SafeguardState, string> = {
  normal: "border-success/40 bg-success/10 text-success",
  monitor: "border-info/40 bg-info/10 text-info",
  warning: "border-warning/50 bg-warning/15 text-warning-foreground",
  restricted: "border-danger/50 bg-danger/10 text-danger",
  hard_block: "border-danger bg-danger text-danger-foreground",
  identity_required: "border-warning/50 bg-warning/15 text-warning-foreground",
  not_tracked: "border-border text-muted-foreground",
};

export const STATE_GUIDANCE: Record<SafeguardState, string> = {
  normal: "Standard dispatch.",
  monitor: "Standard dispatch. Keep an eye on this cleaner's Attributed Cleaner Time here.",
  warning: "Consider rotating cleaner. Confirm that rotation was considered before dispatching.",
  restricted: "Standard dispatch is locked. Leadership review required: a single-clean override by the Director of Operations or an Admin.",
  hard_block: "Standard dispatch is locked at the 95-hour operational safeguard threshold. Only a single-clean emergency override by the Director of Operations or an Admin can allow a clean.",
  identity_required: "A company / vendor login cannot be dispatched directly. Identify the individual cleaner(s) doing the work.",
  not_tracked: "This home is not enrolled in the STR cleaner-hours safeguard.",
};

export const OWNER_ZERO_COPY =
  "Owner participation data is not yet sufficient for comparison. Fixed operational safeguards are being used.";

export const ESTIMATE_SOURCE_LABEL: Record<string, string> = {
  property_standard: "Property standard clean duration",
  historical_average: "Average of this home's last completed cleans",
  conservative_default: "Conservative default (4.0 h)",
  supplied: "Entered estimate",
  none: "No projected clean",
};

export const MANAGER_OVERRIDE_CATEGORIES: { value: string; label: string }[] = [
  { value: "no_alternative_cleaner", label: "No alternative cleaner available" },
  { value: "guest_or_owner_request", label: "Guest or owner specific request" },
  { value: "quality_recovery", label: "Quality recovery clean" },
  { value: "schedule_conflict", label: "Schedule conflict" },
  { value: "other", label: "Other (explain)" },
];

export const EMERGENCY_OVERRIDE_CATEGORIES: { value: string; label: string }[] = [
  { value: "emergency_guest_arrival_imminent", label: "Emergency — guest arrival imminent" },
  { value: "emergency_no_qualified_alternative", label: "Emergency — no qualified alternative reachable" },
  { value: "emergency_health_safety", label: "Emergency — health or safety" },
  { value: "emergency_property_damage", label: "Emergency — property damage response" },
];

export const OVERRIDE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  [...MANAGER_OVERRIDE_CATEGORIES, ...EMERGENCY_OVERRIDE_CATEGORIES].map((c) => [c.value, c.label]),
);

/** Phrases this feature must never display. */
export const PROHIBITED_PHRASES = [
  "owner qualifies",
  "owner fails",
  "meets irs test",
  "safe for tax purposes",
  "tax risk confirmed",
  "material participation disqualified",
];

export type Evaluation = {
  enrolled: boolean;
  state: SafeguardState;
  year?: number;
  worker_name?: string;
  worker_type?: string;
  current_hours?: number;
  projected_clean_hours?: number;
  projected_total_hours?: number;
  estimate_source?: string;
  owner_hours?: number;
  owner_zero?: boolean;
  buffer_hours?: number | null;
  inversion?: boolean;
  segment_start?: string;
  owner_name?: string | null;
  can_override?: boolean;
  override?: { id: string; kind: "manager" | "emergency"; at: string; by: string } | null;
  worker_id?: string;
};

export function hours(h: number | string | null | undefined): string {
  if (h == null || h === "") return "—";
  const n = Number(h);
  return Number.isFinite(n) ? `${n.toFixed(1)} h` : "—";
}

/** Share of the 75-hour Restricted bar, clamped 0–100 for progress bars. */
export function pctOfRestricted(h: number | string | null | undefined): number {
  const n = Number(h ?? 0);
  return Math.max(0, Math.min(100, Math.round((n / 75) * 100)));
}

const STATE_ORDER: SafeguardState[] = ["not_tracked", "normal", "monitor", "warning", "identity_required", "restricted", "hard_block"];
export function worstState(states: SafeguardState[]): SafeguardState {
  return states.reduce<SafeguardState>((w, s) => (STATE_ORDER.indexOf(s) > STATE_ORDER.indexOf(w) ? s : w), "normal");
}
