/**
 * Back up everything: every table in the public schema to one JSON file each, plus a manifest,
 * in one dated folder of the private "backups" bucket. Reads only, apart from its own record in
 * full_backups. Called only after the caller has been checked as an Admin.
 */
import {
  FULL_BACKUP_BUCKET,
  FULL_BACKUP_PAGE,
  buildManifest,
  compareBackup,
  countsOf,
  fullBackupFolder,
  manifestPath,
  sha256Hex,
  tableFilePath,
  tableFileText,
  type FileCheck,
  type Manifest,
  type ManifestTable,
} from "@/lib/full-backup";

type Admin = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  storage: { from: (b: string) => any };
};
type TableInfo = { table_name: string; row_count: number; withheld_columns: string[] | null };

const CONCURRENT = 4;

async function listTables(db: Admin): Promise<TableInfo[]> {
  const { data, error } = await db.rpc("backup_list_tables");
  if (error) throw new Error(`Could not list the tables: ${error.message}`);
  return (data ?? []) as TableInfo[];
}

async function readTable(db: Admin, table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += FULL_BACKUP_PAGE) {
    const { data, error } = await db.rpc("backup_read_table", { _table: table, _offset: offset, _limit: FULL_BACKUP_PAGE });
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    const page = (data ?? []) as unknown[];
    rows.push(...page);
    if (page.length < FULL_BACKUP_PAGE) return rows;
  }
}

async function inBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENT, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

async function put(db: Admin, path: string, text: string) {
  const { error } = await db.storage
    .from(FULL_BACKUP_BUCKET)
    .upload(path, new Blob([text], { type: "application/json" }), { contentType: "application/json", upsert: false });
  if (error) throw new Error(`Saving ${path} failed: ${error.message}`);
}

export async function runFullBackup(db: Admin, userId: string, now = new Date()) {
  const folder = fullBackupFolder(now);
  const startedAt = now.toISOString();
  const { data: rec, error: recErr } = await db
    .from("full_backups")
    .insert({ folder, created_by: userId, created_at: startedAt })
    .select("id")
    .single();
  if (recErr) throw new Error(`Could not start the backup record: ${recErr.message}`);
  const id = (rec as { id: string }).id;
  try {
    const tables = await listTables(db);
    const saved: ManifestTable[] = await inBatches(tables, async (t) => {
      const rows = await readTable(db, t.table_name);
      const withheld = t.withheld_columns ?? [];
      const text = tableFileText(t.table_name, startedAt, rows, withheld);
      await put(db, tableFilePath(folder, t.table_name), text);
      return {
        table: t.table_name,
        rows: rows.length,
        sha256: await sha256Hex(text),
        bytes: new TextEncoder().encode(text).byteLength,
        withheld_columns: withheld,
      };
    });
    const manifest = buildManifest(folder, startedAt, userId, saved);
    const manifestText = JSON.stringify(manifest, null, 2);
    await put(db, manifestPath(folder), manifestText);
    const update = {
      status: "succeeded",
      finished_at: new Date().toISOString(),
      table_count: manifest.table_count,
      total_rows: manifest.total_rows,
      counts: countsOf(manifest),
      manifest_sha256: await sha256Hex(manifestText),
    };
    const { error } = await db.from("full_backups").update(update).eq("id", id);
    if (error) throw new Error(`Could not finish the backup record: ${error.message}`);
    return { ok: true as const, id, folder, tableCount: manifest.table_count, totalRows: manifest.total_rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("full_backups").update({ status: "failed", finished_at: new Date().toISOString(), error: message.slice(0, 1000) }).eq("id", id);
    return { ok: false as const, id, folder, error: message };
  }
}

async function download(db: Admin, path: string): Promise<string | null> {
  const { data, error } = await db.storage.from(FULL_BACKUP_BUCKET).download(path);
  if (error || !data) return null;
  return await (data as Blob).text();
}

export async function verifyFullBackup(db: Admin, userId: string, id: string) {
  const { data: row, error } = await db.from("full_backups").select("id, folder, status, manifest_sha256").eq("id", id).single();
  if (error || !row) throw new Error("That backup was not found.");
  const r = row as { id: string; folder: string; status: string; manifest_sha256: string | null };
  if (r.status !== "succeeded") throw new Error("Only a finished backup can be checked.");
  const manifestText = await download(db, manifestPath(r.folder));
  let result: ReturnType<typeof compareBackup> | { ok: false; error: string };
  if (!manifestText || (await sha256Hex(manifestText)) !== r.manifest_sha256) {
    result = { ok: false, error: "The list of files is missing or has changed." };
  } else {
    const manifest = JSON.parse(manifestText) as Manifest;
    const files: Record<string, FileCheck> = {};
    await inBatches(manifest.tables, async (t) => {
      const text = await download(db, tableFilePath(r.folder, t.table));
      if (text === null) return void (files[t.table] = null);
      try {
        const parsed = JSON.parse(text) as { rows: unknown[] };
        files[t.table] = { rows: parsed.rows.length, sha256: await sha256Hex(text) };
      } catch {
        files[t.table] = null;
      }
    });
    const live = Object.fromEntries((await listTables(db)).map((t) => [t.table_name, Number(t.row_count)]));
    result = compareBackup(manifest, files, live);
  }
  await db
    .from("full_backups")
    .update({ verified_at: new Date().toISOString(), verified_by: userId, verify_ok: result.ok, verify_result: result })
    .eq("id", id);
  return result;
}
