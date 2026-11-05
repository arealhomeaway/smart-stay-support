/**
 * Pure, browser-safe rules for the nightly Resolve backup.
 * Server code (nightly-backup.server.ts) does the reading and uploading.
 */

export const BACKUP_ROOT_FOLDER = "Resolve Backups";
export const BACKUP_RETENTION_DAYS = 60;
export const BACKUP_TIMEZONE = "America/Chicago";
export const BACKUP_LOCAL_HOUR = 2;

/** Every export, in file order. `table` is the source; `file` the CSV name. */
export const BACKUP_EXPORTS = [
  { table: "tickets", file: "tickets.csv" },
  { table: "ticket_activity", file: "ticket-activity.csv" },
  { table: "work_orders", file: "work-orders.csv" },
  { table: "claims", file: "claims.csv" },
  { table: "guest_recovery", file: "guest-refunds-credits.csv" },
  { table: "guest_recovery_ledger", file: "guest-refunds-credits-ledger.csv", orderBy: "recovery_id" },
  { table: "expenses", file: "expenses.csv" },
  { table: "onboarding_tasks", file: "onboarding-tasks.csv" },
] as const;

const DATED = /^\d{4}-\d{2}-\d{2}$/;

/** Central-time calendar date, YYYY-MM-DD. */
export function backupFolderName(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BACKUP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hour (0-23) in Central time. */
export function centralHour(now: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: BACKUP_TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(h);
}

/**
 * The scheduler fires at 07:00 and 08:00 UTC so one of them is 2 a.m. Central
 * in both daylight and standard time. Only the 2 a.m. call runs.
 */
export function isBackupHour(now: Date): boolean {
  return centralHour(now) === BACKUP_LOCAL_HOUR;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV. Columns are the union of keys, in first-seen order. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? [];
  if (!columns) {
    const seen = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) (seen.add(k), cols.push(k));
  }
  const lines = [cols.map(cell).join(",")];
  for (const r of rows) lines.push(cols.map((c) => cell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export type CreatedFolder = { name: string; itemId: string };

/**
 * Folders retention may delete: only dated folders this backup created
 * (recorded in its own run log) and older than the retention window.
 * Anything not in `created` is never touched.
 */
export function foldersToPrune(
  created: CreatedFolder[],
  now: Date,
  retentionDays = BACKUP_RETENTION_DAYS,
): CreatedFolder[] {
  const today = backupFolderName(now);
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffName = cutoff.toISOString().slice(0, 10);
  const seen = new Set<string>();
  return created.filter((f) => {
    if (!DATED.test(f.name) || !f.itemId || seen.has(f.itemId)) return false;
    seen.add(f.itemId);
    return f.name < cutoffName;
  });
}
