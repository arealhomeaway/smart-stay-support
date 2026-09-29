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
