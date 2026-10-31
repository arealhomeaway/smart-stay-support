/**
 * Participation report v2: wording set and entry labels. Browser-safe, pure.
 * Hours, dates, minutes and statuses are never computed or changed here; labels only.
 */

/** The six sentences the reports used before wording became a settings record. */
export const FIXED_REPORT_SENTENCES: readonly string[] = [
  "Reported hours are the homeowner's own record of participation, entered manually by the homeowner. ARHA does not certify or approve these hours.",
  "Entries replaced by a correction, and entries returned for a data-quality question, are excluded from the total.",
  "An activity shared across several homes is counted once in the combined total; the homes are listed for attribution only.",
  "The shared total for each calendar year with a confirmed closing includes every activity dated that year — tagged to any home, General, or before a closing — counted once. Home figures only show which activities were tagged to that home; there is no separate per-home total or minimum.",
  "Every hour is the homeowner's own record, entered manually. Approvals and revisions are logged as actions and never create hours.",
  "This report is an operational record of reported participation. It is not a tax certification and not a guarantee of any tax treatment.",
];

/** Version 1 seed: the fixed sentences, with long dashes removed from sentence 4 only. */
export const WORDING_SEED_V1: readonly string[] = [
  FIXED_REPORT_SENTENCES[0]!,
  FIXED_REPORT_SENTENCES[1]!,
  FIXED_REPORT_SENTENCES[2]!,
  "The shared total for each calendar year with a confirmed closing includes every activity dated that year, whether tagged to any home, General, or dated before a closing, counted once. Home figures only show which activities were tagged to that home; there is no separate per-home total or minimum.",
  FIXED_REPORT_SENTENCES[4]!,
  FIXED_REPORT_SENTENCES[5]!,
];

export type ReportWording = { version: number | null; sentences: readonly string[] };

/** Until the wording record exists, reports keep the fixed sentences (version null). */
export const FALLBACK_WORDING: ReportWording = { version: null, sentences: FIXED_REPORT_SENTENCES };

export function wordingVersionLabel(w: ReportWording) {
  return w.version == null ? "Standard wording" : `Wording version ${w.version}`;
}

const BANNED = /\b(invest|investment|investments|investor|investors|roi)\b/i;

/** Same rule the database enforces on save. Returns a plain-language problem or null. */
export function wordingProblem(sentences: readonly string[]): string | null {
  if (sentences.length !== 6) return "Report wording needs exactly six sentences.";
  for (const s of sentences) {
    if (!s.trim()) return "Every sentence needs text.";
    if (BANNED.test(s) || s.includes("\u2014")) return "Report wording cannot use that word or a long dash.";
  }
  return null;
}

export const EARLIER_ACTIVITY = "Earlier activity";

export type EntryLabelRow = {
  entry_id: string;
  logged_by: string | null;
  card_code: string | null;
  card_title: string | null;
  label_source?: string | null;
};

export type EntryLabel = { loggedBy: string; card: string };

export function cardLabel(code: string | null | undefined, title: string | null | undefined) {
  return code && title ? `${code} ${title}` : EARLIER_ACTIVITY;
}

/** Map of entry id to label. Entries without a row show "Earlier activity" and a neutral name. */
export function buildEntryLabels(rows: readonly EntryLabelRow[]) {
  const m = new Map<string, EntryLabel>();
  for (const r of rows)
    m.set(r.entry_id, { loggedBy: r.logged_by?.trim() || "a homeowner", card: cardLabel(r.card_code, r.card_title) });
  return m;
}

export function labelFor(labels: Map<string, EntryLabel>, entryId: string, fallbackName: string): EntryLabel {
  return labels.get(entryId) ?? { loggedBy: fallbackName, card: EARLIER_ACTIVITY };
}

/** True only when the error says this exact staged function or table is absent. */
export function isMissingReportObject(err: unknown, name: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const m = (e.message ?? "").toLowerCase();
  if (!m.includes(name.toLowerCase())) return false;
  return ["PGRST202", "PGRST205", "42P01", "42883"].includes(e.code ?? "") ||
    m.includes("could not find the function") || m.includes("could not find the table") || m.includes("does not exist");
}
