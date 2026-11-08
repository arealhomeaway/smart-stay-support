/**
 * Back up everything (Emily, Nov 7, 2026; register N8). Pure rules shared by the server step,
 * the Admin tools panel and the tests. Which columns count as secret is decided only in the
 * database (public.backup_secret_column); secret values never leave it.
 */
export const FULL_BACKUP_BUCKET = "backups";
export const FULL_BACKUP_PAGE = 1000;
/** How recent a verified backup must be before the clean slate may run. */
export const CLEAN_SLATE_BACKUP_HOURS = 2;

export type ManifestTable = {
  table: string;
  rows: number;
  sha256: string;
  bytes: number;
  withheld_columns: string[];
};

export type Manifest = {
  folder: string;
  created_at: string;
  created_by: string;
  table_count: number;
  total_rows: number;
  tables: ManifestTable[];
};

const pad = (n: number) => String(n).padStart(2, "0");

/** One dated folder per backup, in UTC, for example 2026-11-08_214012Z. */
export function fullBackupFolder(at: Date): string {
  return (
    `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}_` +
    `${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`
  );
}

export const tableFilePath = (folder: string, table: string) => `${folder}/${table}.json`;
export const manifestPath = (folder: string) => `${folder}/manifest.json`;

/** The exact bytes saved for one table. */
export function tableFileText(table: string, exportedAt: string, rows: unknown[], withheld: string[]) {
  return JSON.stringify({ table, exported_at: exportedAt, withheld_columns: withheld, rows });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildManifest(folder: string, createdAt: string, createdBy: string, tables: ManifestTable[]): Manifest {
  const sorted = [...tables].sort((a, b) => a.table.localeCompare(b.table));
  return {
    folder,
    created_at: createdAt,
    created_by: createdBy,
    table_count: sorted.length,
    total_rows: sorted.reduce((n, t) => n + t.rows, 0),
    tables: sorted,
  };
}

export const countsOf = (m: Manifest) => Object.fromEntries(m.tables.map((t) => [t.table, t.rows]));

export type VerifyLine = {
  table: string;
  saved: number;
  file: number | null;
  live: number | null;
  /** ok: the file matches what was saved and the table still has that many rows.
   *  changed: the file matches; the live table has changed since (new or removed rows).
   *  broken: the file is missing, unreadable, or its count or fingerprint differs. */
  state: "ok" | "changed" | "broken";
};

export type FileCheck = { rows: number; sha256: string } | null;

/** Compare re-read files with the manifest, and with today's live counts. */
export function compareBackup(
  manifest: Manifest,
  files: Record<string, FileCheck>,
  live: Record<string, number>,
): { ok: boolean; lines: VerifyLine[]; broken: number; changed: number; newTables: string[] } {
  const lines: VerifyLine[] = manifest.tables.map((t) => {
    const f = files[t.table] ?? null;
    const liveRows = live[t.table] ?? null;
    const fileOk = f !== null && f.rows === t.rows && f.sha256 === t.sha256;
    return {
      table: t.table,
      saved: t.rows,
      file: f ? f.rows : null,
      live: liveRows,
      state: !fileOk ? "broken" : liveRows === t.rows ? "ok" : "changed",
    };
  });
  const saved = new Set(manifest.tables.map((t) => t.table));
  const newTables = Object.keys(live).filter((t) => !saved.has(t)).sort();
  const broken = lines.filter((l) => l.state === "broken").length;
  return { ok: broken === 0, lines, broken, changed: lines.filter((l) => l.state === "changed").length, newTables };
}

export type FullBackupRow = {
  status: "running" | "succeeded" | "failed";
  finished_at: string | null;
  verify_ok: boolean | null;
};

/** The clean slate's gate, mirrored in its migration: a finished, verified backup in the last 2 hours. */
export function recentVerifiedBackup(rows: FullBackupRow[], now: Date, hours = CLEAN_SLATE_BACKUP_HOURS): boolean {
  const since = now.getTime() - hours * 3600_000;
  return rows.some(
    (r) => r.status === "succeeded" && r.verify_ok === true && r.finished_at !== null && Date.parse(r.finished_at) >= since,
  );
}
