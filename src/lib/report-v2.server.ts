/**
 * Participation report v2 loaders. Every loader degrades to today's behavior when the
 * staged database objects are missing, and surfaces any other error.
 */
import {
  FALLBACK_WORDING,
  buildEntryLabels,
  isMissingReportObject,
  type EntryLabel,
  type EntryLabelRow,
  type ReportWording,
} from "./report-v2";

type Res = { data: unknown; error: { code?: string; message?: string } | null };
type Sb = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<Res> };
const sb = (c: unknown) => c as Sb;

export async function loadReportWording(client: unknown): Promise<ReportWording> {
  const res = await sb(client).rpc("report_wording_current");
  if (res?.error) {
    if (isMissingReportObject(res.error, "report_wording_current")) return FALLBACK_WORDING;
    throw new Error(res.error.message ?? "Could not read report wording.");
  }
  const row = res?.data as { version?: number; sentences?: unknown } | null | undefined;
  if (!row || typeof row.version !== "number" || !Array.isArray(row.sentences) || row.sentences.length !== 6) return FALLBACK_WORDING;
  return { version: row.version, sentences: row.sentences.map(String) };
}

export async function loadEntryLabels(client: unknown, entryIds: string[]): Promise<Map<string, EntryLabel>> {
  if (entryIds.length === 0) return new Map();
  const res = await sb(client).rpc("report_entry_labels", { _entry_ids: entryIds });
  if (res?.error) {
    if (isMissingReportObject(res.error, "report_entry_labels")) return new Map();
    throw new Error(res.error.message ?? "Could not label report entries.");
  }
  return buildEntryLabels(Array.isArray(res?.data) ? (res.data as EntryLabelRow[]) : []);
}

/** Records which wording version a downloaded file used. Skipped until the wording record exists. */
export async function recordWordingUse(
  client: unknown,
  input: { programId: string | null; kind: "owner_participation" | "str_report"; ref: string | null; format: "pdf" | "csv"; wording: ReportWording },
) {
  if (input.wording.version == null) return { recorded: false as const };
  const res = await sb(client).rpc("record_report_wording_use", {
    _program: input.programId,
    _kind: input.kind,
    _ref: input.ref,
    _format: input.format,
    _version: input.wording.version,
  });
  if (res?.error) {
    if (isMissingReportObject(res.error, "record_report_wording_use")) return { recorded: false as const };
    throw new Error(res.error.message ?? "Could not record the report wording.");
  }
  return { recorded: true as const };
}
