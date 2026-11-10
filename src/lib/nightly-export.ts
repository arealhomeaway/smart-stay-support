/**
 * The full nightly export to SharePoint (register N10; Emily, Nov 9, 2026). Pure, browser-safe
 * rules shared by the server step, the Export check page and the tests.
 *
 * One list of tables: public.backup_list_tables, the same list Back up everything uses, so a new
 * table is covered the next night without a code change. Secret columns are left out by the
 * database (public.backup_secret_column) and the login system's tables are not in the public
 * schema, so they are never read.
 */
import { backupFolderName, centralHour } from "@/lib/nightly-backup";

/** The export works from 2 a.m. until 5 a.m. Central; a night not finished by 5 a.m. alerts. */
export const EXPORT_START_HOUR = 2;
export const EXPORT_MISSED_HOUR = 5;
/** Rows per file. A table with more rows is written in numbered parts so each file uploads. */
export const EXPORT_PART_ROWS = 5000;
/** Graph takes a simple upload up to 4 MB; anything larger goes through an upload session. */
export const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024;
export const TABLES_FOLDER = "tables";
export const FILES_FOLDER = "files";
export const MANIFEST_FILE = "manifest.json";
export const INVENTORY_FILE = "files-inventory.csv";
export const TEST_FOLDER_PREFIX = "TEST export ";
export const EXPORT_SETTINGS_KEY = "nightly_export_settings";

export type ExportSettings = {
  /** Nightly folders kept. */
  dailyKeep: number;
  /** Weekly folders (the nights with a full copy of every stored file) kept. */
  weeklyKeep: number;
  /** Day of the week for the full file copy, 0 = Sunday (Central date). */
  weeklyDay: number;
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = { dailyKeep: 30, weeklyKeep: 12, weeklyDay: 0 };

const whole = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

/** The saved setting, with the defaults for anything missing or out of range. */
export function readExportSettings(value: unknown): ExportSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    dailyKeep: whole(v["daily_keep"], 1, 365, DEFAULT_EXPORT_SETTINGS.dailyKeep),
    weeklyKeep: whole(v["weekly_keep"], 0, 104, DEFAULT_EXPORT_SETTINGS.weeklyKeep),
    weeklyDay: whole(v["weekly_day"], 0, 6, DEFAULT_EXPORT_SETTINGS.weeklyDay),
  };
}

/** Tonight's folder: the Central calendar date, the same name the existing nightly backup uses. */
export const exportFolderName = (now: Date) => backupFolderName(now);

/** Calls between 2 and 5 a.m. Central do the work; any other call does nothing. */
export function inExportWindow(now: Date): boolean {
  const h = centralHour(now);
  return h >= EXPORT_START_HOUR && h < EXPORT_MISSED_HOUR;
}

/** The weekly night copies every stored file; other nights copy only new or changed files. */
export function isWeeklyNight(folder: string, settings: ExportSettings = DEFAULT_EXPORT_SETTINGS): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(folder)) return false;
  return new Date(`${folder}T12:00:00Z`).getUTCDay() === settings.weeklyDay;
}

/** A table file name: one file, or numbered parts when the table has more rows than one file holds. */
export function tablePartName(table: string, part: number | null): string {
  return part === null ? `${table}.json` : `${table}.part-${String(part).padStart(3, "0")}.json`;
}

/** Whether a table is written in parts, decided from its row count when the run started. */
export const usesParts = (rowsAtStart: number) => rowsAtStart > EXPORT_PART_ROWS;

/* ------------------------------------------------------------------------- */
/* Stored files                                                               */
/* ------------------------------------------------------------------------- */

export type StoredFile = {
  bucket: string;
  name: string;
  size: number;
  etag: string | null;
  mimetype: string | null;
  updated_at: string | null;
  owner_type: string | null;
  owner_id: string | null;
  owner_label: string | null;
};

/**
 * Stored files that are never copied, with the reason written in the inventory:
 * the backups bucket is the Back up everything output (its tables are already in this export),
 * and the old database dump files can hold the login system's private data.
 */
export function notCopiedReason(bucket: string): string | null {
  if (bucket === "backups") return "Not copied: database backups; the tables are already in this export.";
  if (/^database_export_/.test(bucket)) return "Not copied: old database dump; it can hold login system data.";
  return null;
}

const fileKey = (f: { bucket: string; name: string }) => `${f.bucket}/${f.name}`;

/**
 * Which stored files to copy tonight. The weekly night copies every file; other nights copy a
 * file only when it was never copied or its fingerprint (etag) or size has changed since.
 */
export function filesToCopy(
  files: StoredFile[],
  copied: Map<string, { etag: string | null; size: number }>,
  weekly: boolean,
): StoredFile[] {
  return files.filter((f) => {
    if (notCopiedReason(f.bucket)) return false;
    if (weekly) return true;
    const prev = copied.get(fileKey(f));
    return !prev || prev.etag !== f.etag || Number(prev.size) !== Number(f.size);
  });
}
export { fileKey };

/** SharePoint does not accept some characters in a name; they become an underscore. */
export function sharePointSafeSegment(segment: string): string {
  const s = segment.replace(/["*:<>?\\|#%]/g, "_").replace(/[\u0000-\u001f]/g, "_").trim();
  const t = s.replace(/[. ]+$/g, "");
  return t === "" || t === "." || t === ".." ? "_" : t;
}

/** Where a copied stored file goes inside the night's folder: files/<bucket>/<path>. */
export function copiedFilePath(f: { bucket: string; name: string }): string {
  return [FILES_FOLDER, f.bucket, ...f.name.split("/")].map(sharePointSafeSegment).join("/");
}

/* ------------------------------------------------------------------------- */
/* Manifest                                                                   */
/* ------------------------------------------------------------------------- */

export type ExportFile = { name: string; rows: number; sha256: string; bytes: number };

export type ExportTable = {
  table: string;
  rows: number;
  /** The table's row count when the run started, and when every table had been read. */
  rows_at_start: number;
  rows_at_end: number | null;
  /** The file's fingerprint; for a table in parts, the fingerprint of its parts' fingerprints in order. */
  sha256: string;
  bytes: number;
  withheld_columns: string[];
  files: ExportFile[];
};

export type ExportManifest = {
  folder: string;
  kind: "nightly" | "test";
  weekly: boolean;
  started_at: string;
  table_count: number;
  total_rows: number;
  tables: ExportTable[];
  /** The 8 readable spreadsheets kept from the first nightly backup, and the file inventory. */
  other_files: ExportFile[];
  stored_files: {
    inventoried: number;
    copied: number;
    bytes_copied: number;
    failed: { bucket: string; name: string; reason: string }[];
    not_copied: { bucket: string; files: number; bytes: number; reason: string }[];
  };
};

export function buildExportManifest(m: Omit<ExportManifest, "table_count" | "total_rows">): ExportManifest {
  const tables = [...m.tables].sort((a, b) => a.table.localeCompare(b.table));
  return {
    ...m,
    tables,
    table_count: tables.length,
    total_rows: tables.reduce((n, t) => n + t.rows, 0),
  };
}

/* ------------------------------------------------------------------------- */
/* Verify                                                                     */
/* ------------------------------------------------------------------------- */

/** How a SharePoint listing is keyed: "tables/<file>" inside the tables folder, "<file>" at the top. */
export const remoteKey = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

export type VerifyState = "ok" | "grew" | "fewer" | "gone" | "broken";
export type ExportVerifyLine = { table: string; saved: number; live: number | null; state: VerifyState; reason?: string };
export type ExportVerify = {
  status: "passed" | "failed";
  reasons: string[];
  lines: ExportVerifyLine[];
  /** Rows added to the live tables after they were saved (allowed, not a failure). */
  rows_added_since: number;
  new_tables: string[];
};

/**
 * How a night passes (Emily, Nov 9: allow for rows added while it ran):
 *  - the manifest read back from SharePoint matches the one written, byte for byte;
 *  - every table that existed when the run started is in it;
 *  - every file it lists is in SharePoint with the same size;
 *  - each table saved at least as many rows as the smaller of its counts at the start and at the
 *    end of the run (fewer would mean rows were missed while reading);
 *  - no stored file failed to copy.
 * Afterwards each saved count is compared with the live table: more rows live is fine (rows added
 * after the table was saved, shown as "grew"); fewer live is shown ("fewer") but does not fail,
 * because the export holds every row that was there.
 */
export function verifyExport(input: {
  manifest: ExportManifest | null;
  manifestMatches: boolean;
  tablesAtStart: string[];
  remoteSizes: Record<string, number>;
  live: Record<string, number>;
}): ExportVerify {
  const reasons: string[] = [];
  const m = input.manifest;
  if (!m || !input.manifestMatches) {
    return {
      status: "failed",
      reasons: ["The list of tables saved in SharePoint could not be read back, or it has changed."],
      lines: [],
      rows_added_since: 0,
      new_tables: [],
    };
  }
  const saved = new Set(m.tables.map((t) => t.table));
  const missing = input.tablesAtStart.filter((t) => !saved.has(t)).sort();
  for (const t of missing) reasons.push(`Table ${t} is missing from the export.`);

  const sizeOk = (f: ExportFile, folder: string) => input.remoteSizes[remoteKey(folder, f.name)] === f.bytes;
  let added = 0;
  const lines: ExportVerifyLine[] = m.tables.map((t) => {
    const bad = t.files.find((f) => !sizeOk(f, TABLES_FOLDER));
    const live = input.live[t.table] ?? null;
    if (bad) {
      const reason =
        input.remoteSizes[remoteKey(TABLES_FOLDER, bad.name)] === undefined
          ? `File ${bad.name} is missing in SharePoint.`
          : `File ${bad.name} in SharePoint is not the size that was written.`;
      reasons.push(reason);
      return { table: t.table, saved: t.rows, live, state: "broken", reason };
    }
    const floor = Math.min(t.rows_at_start, t.rows_at_end ?? t.rows_at_start);
    if (t.rows < floor) {
      const reason = `Table ${t.table} saved ${t.rows} rows but had at least ${floor} while it ran.`;
      reasons.push(reason);
      return { table: t.table, saved: t.rows, live, state: "broken", reason };
    }
    if (live === null) return { table: t.table, saved: t.rows, live, state: "gone" };
    if (live > t.rows) {
      added += live - t.rows;
      return { table: t.table, saved: t.rows, live, state: "grew" };
    }
    return { table: t.table, saved: t.rows, live, state: live === t.rows ? "ok" : "fewer" };
  });
  for (const f of m.other_files) {
    if (!sizeOk(f, "")) reasons.push(`File ${f.name} is missing in SharePoint or is not the size that was written.`);
  }
  const failed = m.stored_files.failed.length;
  if (failed) reasons.push(`${failed} stored file${failed === 1 ? "" : "s"} could not be copied.`);
  const start = new Set(input.tablesAtStart);
  const new_tables = Object.keys(input.live).filter((t) => !start.has(t) && !saved.has(t)).sort();
  return { status: reasons.length ? "failed" : "passed", reasons, lines, rows_added_since: added, new_tables };
}

/* ------------------------------------------------------------------------- */
/* Keeping folders                                                            */
/* ------------------------------------------------------------------------- */

export type KeptFolder = { name: string; itemId: string; weekly: boolean };

/**
 * Folders to remove after a night that passed: keep the newest `dailyKeep` dated folders, and
 * the newest `weeklyKeep` weekly folders even when they are older. Only dated folders this export
 * recorded as created are ever considered; a test folder or anything else is never touched.
 */
export function exportFoldersToPrune(created: KeptFolder[], settings: ExportSettings): KeptFolder[] {
  const byId = new Map<string, KeptFolder>();
  for (const f of created) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.name) || !f.itemId) continue;
    const prev = byId.get(f.itemId);
    byId.set(f.itemId, prev ? { ...prev, weekly: prev.weekly || f.weekly } : f);
  }
  const all = [...byId.values()].sort((a, b) => b.name.localeCompare(a.name));
  const keep = new Set(all.slice(0, settings.dailyKeep).map((f) => f.itemId));
  for (const f of all.filter((x) => x.weekly).slice(0, settings.weeklyKeep)) keep.add(f.itemId);
  return all.filter((f) => !keep.has(f.itemId)).sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------------- */
/* Export check page                                                          */
/* ------------------------------------------------------------------------- */

export type ExportRunRow = {
  id: string;
  folder_name: string;
  status: "running" | "succeeded" | "failed";
  phase: string | null;
  weekly: boolean | null;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  table_count: number | null;
  total_rows: number | null;
  files_inventoried: number | null;
  files_copied: number | null;
  bytes_copied: number | null;
  verify_status: "passed" | "failed" | null;
  verify_reasons: string[] | null;
  folder_item_id: string | null;
  pruned_at: string | null;
};

/** The one word a run gets on the check page. */
export function runResult(r: Pick<ExportRunRow, "phase" | "status" | "verify_status">): "Passed" | "Failed" | "Running" | "Not checked" {
  if (r.phase === null) return r.status === "failed" ? "Failed" : r.status === "running" ? "Running" : "Not checked";
  if (r.verify_status === "passed") return "Passed";
  if (r.verify_status === "failed" || r.status === "failed") return "Failed";
  return "Running";
}

/** The newest and oldest night folders still kept in SharePoint. */
export function keptRange(rows: Pick<ExportRunRow, "folder_name" | "folder_item_id" | "pruned_at">[]) {
  const names = [
    ...new Set(
      rows.filter((r) => r.folder_item_id && !r.pruned_at && /^\d{4}-\d{2}-\d{2}$/.test(r.folder_name)).map((r) => r.folder_name),
    ),
  ].sort();
  return { oldest: names[0] ?? null, newest: names[names.length - 1] ?? null, count: names.length };
}

/** Plain size, for example 1.6 GB. */
export function plainSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} bytes`;
}
