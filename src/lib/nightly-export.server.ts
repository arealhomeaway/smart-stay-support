/**
 * The full nightly export to SharePoint (register N10; Emily, Nov 9, 2026). Server only.
 *
 * Every table in the public schema (the Back up everything list and reader), the 8 readable
 * spreadsheets the nightly backup already wrote, an inventory of every stored file and a copy of
 * new or changed stored files (every file on the weekly night), in one dated folder of
 * ARHA Resolve > Documents > Resolve Backups. Then it reads the manifest back, checks every file
 * and compares counts with the live tables, records Passed or Failed, alerts on a failure, and
 * keeps 30 nightly and 12 weekly folders.
 *
 * A night is done in steps: each scheduled call works for a few minutes and saves where it got
 * to in its run record, so no single call has to finish everything. Reads Resolve records only;
 * writes only its own run record, its copy record and, on failure, the alert.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getServiceSharePointConnectionKey } from "@/lib/sharepoint-connection.server";
import { ARHA_RESOLVE_SITE_PATH, SHAREPOINT_CONNECTOR_ID, SHAREPOINT_GATEWAY_BASE_URL } from "@/lib/sharepoint";
import { BACKUP_EXPORTS, BACKUP_ROOT_FOLDER, toCsv } from "@/lib/nightly-backup";
import { FULL_BACKUP_PAGE, fullBackupFolder, sha256Hex, tableFileText } from "@/lib/full-backup";
import { listTables } from "@/lib/full-backup.server";
import {
  EXPORT_PART_ROWS,
  EXPORT_SETTINGS_KEY,
  INVENTORY_FILE,
  MANIFEST_FILE,
  SIMPLE_UPLOAD_MAX,
  TABLES_FOLDER,
  TEST_FOLDER_PREFIX,
  buildExportManifest,
  copiedFilePath,
  exportFolderName,
  exportFoldersToPrune,
  fileKey,
  filesToCopy,
  isWeeklyNight,
  notCopiedReason,
  readExportSettings,
  remoteKey,
  tablePartName,
  usesParts,
  verifyExport,
  type ExportFile,
  type ExportManifest,
  type ExportTable,
  type ExportVerify,
  type KeptFolder,
  type StoredFile,
} from "@/lib/nightly-export";

type Db = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  storage: { from: (b: string) => any };
};

/** What the export needs from SharePoint. The real one is below; tests pass a stand-in. */
export interface SharePointIo {
  root(): Promise<{ driveId: string; rootId: string }>;
  ensureFolder(driveId: string, parentId: string, name: string): Promise<string>;
  /** Upload to a path under a folder (sub folders are made as needed). Returns the bytes written. */
  put(driveId: string, folderId: string, relPath: string, bytes: Uint8Array, contentType: string): Promise<number>;
  /** Upload a large file in chunks read on demand. */
  putLarge(
    driveId: string,
    folderId: string,
    relPath: string,
    size: number,
    readChunk: (start: number, end: number) => Promise<Uint8Array>,
  ): Promise<number>;
  readText(driveId: string, folderId: string, relPath: string): Promise<string | null>;
  /** Names and sizes of a folder's direct children. */
  listSizes(driveId: string, folderId: string): Promise<Record<string, number>>;
  remove(driveId: string, itemId: string): Promise<void>;
}

const CHUNK = 320 * 1024 * 16; // 5 MiB, a multiple of 320 KiB as Graph requires
const encPath = (rel: string) => rel.split("/").map(encodeURIComponent).join("/");

export function realSharePoint(key: string): SharePointIo {
  const call = (path: string, init?: RequestInit) =>
    callAsAppUser({
      gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL,
      connectorId: SHAREPOINT_CONNECTOR_ID,
      connectionAPIKey: key,
      path,
      ...(init ? { init } : {}),
    });
  const graph = async (path: string, init?: RequestInit) => {
    const res = await call(path, init);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SharePoint ${init?.method ?? "GET"} failed [${res.status}]: ${body.slice(0, 300)}`);
    }
    return res.status === 204 ? null : res.json();
  };
  const session = async (driveId: string, folderId: string, relPath: string) =>
    (await graph(`/drives/${driveId}/items/${folderId}:/${encPath(relPath)}:/createUploadSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
    })) as { uploadUrl: string };
  const sendChunks = async (
    uploadUrl: string,
    size: number,
    readChunk: (start: number, end: number) => Promise<Uint8Array>,
    name: string,
  ) => {
    for (let start = 0; start < size; start += CHUNK) {
      const end = Math.min(start + CHUNK, size);
      const body = await readChunk(start, end);
      // The pre-authenticated upload URL goes straight to Microsoft, without credentials.
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Length": String(end - start), "Content-Range": `bytes ${start}-${end - 1}/${size}` },
        body: body as BodyInit,
      });
      if (!res.ok && res.status !== 202) {
        throw new Error(`Upload of ${name} failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      }
    }
    return size;
  };
  return {
    async root() {
      const drive = (await graph(`${ARHA_RESOLVE_SITE_PATH}:/drive?$select=id`)) as { id: string };
      const root = (await graph(`/drives/${drive.id}/root?$select=id`)) as { id: string };
      return { driveId: drive.id, rootId: root.id };
    },
    async ensureFolder(driveId, parentId, name) {
      const res = await call(`/drives/${driveId}/items/${parentId}:/${encodeURIComponent(name)}?$select=id,folder`);
      if (res.ok) return ((await res.json()) as { id: string }).id;
      if (res.status !== 404) throw new Error(`SharePoint GET failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      const made = (await graph(`/drives/${driveId}/items/${parentId}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
      })) as { id: string };
      return made.id;
    },
    async put(driveId, folderId, relPath, bytes, contentType) {
      if (bytes.byteLength <= SIMPLE_UPLOAD_MAX) {
        await graph(`/drives/${driveId}/items/${folderId}:/${encPath(relPath)}:/content`, {
          method: "PUT",
          headers: { "Content-Type": contentType || "application/octet-stream" },
          body: bytes as BodyInit,
        });
        return bytes.byteLength;
      }
      const s = await session(driveId, folderId, relPath);
      return sendChunks(s.uploadUrl, bytes.byteLength, async (a, b) => bytes.slice(a, b), relPath);
    },
    async putLarge(driveId, folderId, relPath, size, readChunk) {
      const s = await session(driveId, folderId, relPath);
      return sendChunks(s.uploadUrl, size, readChunk, relPath);
    },
    async readText(driveId, folderId, relPath) {
      const res = await call(`/drives/${driveId}/items/${folderId}:/${encPath(relPath)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`SharePoint GET failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      const item = (await res.json()) as { "@microsoft.graph.downloadUrl"?: string };
      const url = item["@microsoft.graph.downloadUrl"];
      if (!url) return null;
      // A short-lived, pre-authenticated download link from Microsoft.
      const file = await fetch(url);
      return file.ok ? await file.text() : null;
    },
    async listSizes(driveId, folderId) {
      const out: Record<string, number> = {};
      let path: string | null = `/drives/${driveId}/items/${folderId}/children?$select=name,size&$top=999`;
      while (path) {
        const page = (await graph(path)) as { value: { name: string; size: number }[]; "@odata.nextLink"?: string };
        for (const c of page.value ?? []) out[c.name] = Number(c.size);
        const next = page["@odata.nextLink"];
        path = next ? next.replace(/^https:\/\/graph\.microsoft\.com\/v1\.0/, "") : null;
      }
      return out;
    },
    async remove(driveId, itemId) {
      const res = await call(`/drives/${driveId}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        throw new Error(`SharePoint DELETE failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      }
    },
  };
}

/* ------------------------------------------------------------------------- */

type TableStart = { table: string; rows: number; withheld: string[] };
type CopyItem = { b: string; n: string; s: number; e: string | null; m: string | null };
type Progress = {
  drive_id?: string;
  folder_id?: string;
  tables_folder_id?: string;
  tables_at_start?: TableStart[];
  done?: ExportTable[];
  counts_at_end?: Record<string, number>;
  other_files?: ExportFile[];
  copy?: { queue: CopyItem[]; index: number; copied: number; bytes: number; failed: { bucket: string; name: string; reason: string }[] };
  stored_files?: ExportManifest["stored_files"];
  manifest_sha256?: string;
  failed_calls?: number;
  last_error?: string;
};

type Phase = "start" | "tables" | "files" | "manifest" | "verify" | "prune" | "done";

export type ExportStepOptions = {
  now?: Date;
  trigger?: "schedule" | "manual";
  /** A test run goes to its own clearly named folder, never alerts, never prunes, never marks files as copied. */
  kind?: "nightly" | "test";
  /** How long this call may work before it saves and stops. */
  budgetMs?: number;
  /** Test only: copy every stored file, as the weekly night does. */
  forceWeekly?: boolean;
  /** Test only: alert even though this is a test run (the forced failure check). */
  alertOnFailure?: boolean;
  /** Test only: an exact folder name. */
  folderName?: string;
};

export type ExportStepResult =
  | { ok: true; skipped: string }
  | { ok: true; runId: string; folder: string; phase: Phase; verify?: ExportVerify["status"] }
  | { ok: false; runId: string | null; folder: string; error: string };

/** Stop after this many calls in a row fail on the same night; the run is then Failed and alerts. */
const MAX_FAILED_CALLS = 3;
const TABLE_CONCURRENCY = 3;

const text = (s: string) => new TextEncoder().encode(s);

async function readPart(db: Db, table: string, offset: number, limit: number): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let at = offset; at < offset + limit; at += FULL_BACKUP_PAGE) {
    const n = Math.min(FULL_BACKUP_PAGE, offset + limit - at);
    const { data, error } = await db.rpc("backup_read_table", { _table: table, _offset: at, _limit: n });
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    const page = (data ?? []) as unknown[];
    rows.push(...page);
    if (page.length < n) break;
  }
  return rows;
}

async function readAll(db: Db, table: string, orderBy: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").order(orderBy, { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** One table into one file, or numbered parts of EXPORT_PART_ROWS rows. */
async function exportTable(
  db: Db,
  sp: SharePointIo,
  driveId: string,
  folderId: string,
  t: TableStart,
  startedAt: string,
): Promise<ExportTable> {
  const files: ExportFile[] = [];
  const write = async (name: string, rows: unknown[]) => {
    const body = tableFileText(t.table, startedAt, rows, t.withheld);
    const bytes = text(body);
    await sp.put(driveId, folderId, name, bytes, "application/json");
    files.push({ name, rows: rows.length, sha256: await sha256Hex(body), bytes: bytes.byteLength });
  };
  if (!usesParts(t.rows)) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += FULL_BACKUP_PAGE) {
      const page = await readPart(db, t.table, offset, FULL_BACKUP_PAGE);
      rows.push(...page);
      if (page.length < FULL_BACKUP_PAGE) break;
    }
    await write(tablePartName(t.table, null), rows);
  } else {
    for (let part = 1, offset = 0; ; part++, offset += EXPORT_PART_ROWS) {
      const rows = await readPart(db, t.table, offset, EXPORT_PART_ROWS);
      if (rows.length === 0 && part > 1) break;
      await write(tablePartName(t.table, part), rows);
      if (rows.length < EXPORT_PART_ROWS) break;
    }
  }
  const sha256 = files.length === 1 ? files[0]!.sha256 : await sha256Hex(files.map((f) => f.sha256).join("\n"));
  return {
    table: t.table,
    rows: files.reduce((n, f) => n + f.rows, 0),
    rows_at_start: t.rows,
    rows_at_end: null,
    sha256,
    bytes: files.reduce((n, f) => n + f.bytes, 0),
    withheld_columns: t.withheld,
    files,
  };
}

async function listStoredFiles(db: Db): Promise<StoredFile[]> {
  const { data, error } = await db.rpc("backup_list_files");
  if (error) throw new Error(`Could not list the stored files: ${error.message}`);
  return ((data ?? []) as StoredFile[]).map((f) => ({ ...f, size: Number(f.size ?? 0) }));
}

async function copyStoredFile(db: Db, sp: SharePointIo, driveId: string, folderId: string, f: CopyItem): Promise<number> {
  const rel = copiedFilePath({ bucket: f.b, name: f.n });
  const store = db.storage.from(f.b);
  if (f.s <= SIMPLE_UPLOAD_MAX) {
    const { data, error } = await store.download(f.n);
    if (error || !data) throw new Error(error?.message ?? "could not be read from storage");
    return sp.put(driveId, folderId, rel, new Uint8Array(await (data as Blob).arrayBuffer()), f.m ?? "application/octet-stream");
  }
  const { data: signed, error } = await store.createSignedUrl(f.n, 3600);
  if (error || !signed?.signedUrl) throw new Error(error?.message ?? "no download link");
  return sp.putLarge(driveId, folderId, rel, f.s, async (start, end) => {
    const res = await fetch(signed.signedUrl as string, { headers: { Range: `bytes=${start}-${end - 1}` } });
    if (!res.ok && res.status !== 206) throw new Error(`storage read failed [${res.status}]`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength !== end - start) throw new Error("storage returned a different size than expected");
    return buf;
  });
}

function inventoryCsv(files: StoredFile[], copiedTonight: Set<string>, failed: Map<string, string>, weekly: boolean): string {
  return toCsv(
    files.map((f) => {
      const k = fileKey(f);
      const slash = f.name.lastIndexOf("/");
      return {
        bucket: f.bucket,
        folder: slash >= 0 ? f.name.slice(0, slash) : "",
        name: slash >= 0 ? f.name.slice(slash + 1) : f.name,
        size_bytes: f.size,
        etag: f.etag ?? "",
        type: f.mimetype ?? "",
        updated_at: f.updated_at ?? "",
        owner_type: f.owner_type ?? "",
        owner_id: f.owner_id ?? "",
        owner: f.owner_label ?? "",
        copy:
          notCopiedReason(f.bucket) ??
          (failed.has(k)
            ? `Failed: ${failed.get(k)}`
            : copiedTonight.has(k)
              ? `Copied tonight to ${copiedFilePath(f)}`
              : weekly
                ? "Copied tonight"
                : "Unchanged since its last copy"),
      };
    }),
    ["bucket", "folder", "name", "size_bytes", "etag", "type", "updated_at", "owner_type", "owner_id", "owner", "copy"],
  );
}

async function alert(db: Db, folder: string, reason: "failed" | "missed", message: string) {
  const { error } = await db.rpc("nightly_export_alert", { _folder: folder, _reason: reason, _message: message.slice(0, 900) });
  if (error) throw new Error(`The alert could not be saved: ${error.message}`);
}

/**
 * One scheduled call: start tonight's export or continue it, then save where it got to.
 * Safe to call again at any time: a finished night is skipped and a night already being worked
 * by another call is left alone.
 */
export async function runNightlyExportStep(
  db: Db,
  opts: ExportStepOptions = {},
  io?: SharePointIo,
): Promise<ExportStepResult> {
  const now = opts.now ?? new Date();
  const kind = opts.kind ?? "nightly";
  const budget = opts.budgetMs ?? 200_000;
  const deadline = Date.now() + budget;
  const folder = opts.folderName ?? (kind === "test" ? `${TEST_FOLDER_PREFIX}${fullBackupFolder(now)}` : exportFolderName(now));
  const alerts = kind === "nightly" || opts.alertOnFailure === true;

  const settingsRow = await db.from("app_settings").select("value").eq("key", EXPORT_SETTINGS_KEY).maybeSingle();
  const settings = readExportSettings(settingsRow?.data?.value);

  // Tonight's run record (the export's own; an older style record for the same date is left as it is).
  const found = await db
    .from("backup_runs")
    .select("id, phase, weekly, progress, started_at")
    .eq("kind", kind)
    .eq("folder_name", folder)
    .not("phase", "is", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (found.error) return { ok: false, runId: null, folder, error: `Run log unavailable: ${found.error.message}` };
  let run = (found.data ?? [])[0] as { id: string; phase: Phase; weekly: boolean; progress: Progress | null; started_at: string } | undefined;
  if (run?.phase === "done") return { ok: true, skipped: `Export for ${folder} already done` };
  if (!run) {
    const weekly = opts.forceWeekly === true || (kind === "nightly" && isWeeklyNight(folder, settings));
    const made = await db
      .from("backup_runs")
      .insert({ folder_name: folder, status: "running", trigger: opts.trigger ?? "schedule", kind, weekly, phase: "start", progress: {} })
      .select("id, phase, weekly, progress, started_at")
      .single();
    if (made.error) {
      // Another call started the same night a moment ago.
      return { ok: true, skipped: `Export for ${folder} is starting in another call` };
    }
    run = made.data;
  }
  const runId = run!.id;
  const lease = await db
    .from("backup_runs")
    .update({ lease_until: new Date(Date.now() + budget + 60_000).toISOString() })
    .eq("id", runId)
    .or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`)
    .select("id");
  if (lease.error) return { ok: false, runId, folder, error: `Run log unavailable: ${lease.error.message}` };
  if (!lease.data?.length) return { ok: true, skipped: `Export for ${folder} is being worked by another call` };

  let phase: Phase = run!.phase;
  const p: Progress = { ...(run!.progress ?? {}) };
  const weekly = Boolean(run!.weekly);
  const startedAt = run!.started_at;
  const save = async (extra: Record<string, unknown> = {}) => {
    const { error } = await db.from("backup_runs").update({ phase, progress: p, ...extra }).eq("id", runId);
    if (error) throw new Error(`Could not save the run record: ${error.message}`);
  };
  const timeLeft = () => Date.now() < deadline;

  try {
    let sp = io;
    if (!sp) {
      const key = await getServiceSharePointConnectionKey();
      if (!key) throw new Error("Resolve's SharePoint integration is not connected.");
      sp = realSharePoint(key);
    }

    if (phase === "start") {
      const { driveId, rootId } = await sp.root();
      const top = await sp.ensureFolder(driveId, rootId, BACKUP_ROOT_FOLDER);
      const dated = await sp.ensureFolder(driveId, top, folder);
      const tablesFolder = await sp.ensureFolder(driveId, dated, TABLES_FOLDER);
      const tables = await listTables(db as never);
      p.drive_id = driveId;
      p.folder_id = dated;
      p.tables_folder_id = tablesFolder;
      p.tables_at_start = tables.map((t) => ({ table: t.table_name, rows: Number(t.row_count), withheld: t.withheld_columns ?? [] }));
      p.done = [];
      phase = "tables";
      await save({ folder_item_id: dated, sharepoint_path: `${BACKUP_ROOT_FOLDER}/${folder}` });
    }
    const driveId = p.drive_id!;
    const folderId = p.folder_id!;

    if (phase === "tables") {
      const doneSet = new Set((p.done ?? []).map((t) => t.table));
      const pending = (p.tables_at_start ?? []).filter((t) => !doneSet.has(t.table));
      while (pending.length && timeLeft()) {
        const batch = pending.splice(0, TABLE_CONCURRENCY);
        const results = await Promise.all(batch.map((t) => exportTable(db, sp!, driveId, p.tables_folder_id!, t, startedAt)));
        p.done = [...(p.done ?? []), ...results];
        await save();
      }
      if (!pending.length) {
        // The readable spreadsheets the nightly backup has always written, unchanged.
        if (!p.other_files) {
          const other: ExportFile[] = [];
          for (const exp of BACKUP_EXPORTS) {
            const rows = await readAll(db, exp.table, "orderBy" in exp ? exp.orderBy : "id");
            const body = toCsv(rows);
            const bytes = text(body);
            await sp.put(driveId, folderId, exp.file, bytes, "text/csv");
            other.push({ name: exp.file, rows: rows.length, sha256: await sha256Hex(body), bytes: bytes.byteLength });
          }
          p.other_files = other;
        }
        const end = await listTables(db as never);
        p.counts_at_end = Object.fromEntries(end.map((t) => [t.table_name, Number(t.row_count)]));
        p.done = (p.done ?? []).map((t) => ({ ...t, rows_at_end: p.counts_at_end![t.table] ?? null }));
        phase = "files";
        await save({
          table_count: p.done.length,
          total_rows: p.done.reduce((n, t) => n + t.rows, 0),
          files: [...p.done.flatMap((t) => t.files), ...p.other_files].map((f) => ({ file: f.name, rows: f.rows })),
        });
      }
    }

    if (phase === "files" && timeLeft()) {
      if (!p.copy) {
        const stored = await listStoredFiles(db);
        const copied = new Map<string, { etag: string | null; size: number }>();
        if (!weekly) {
          for (let from = 0; ; from += 1000) {
            const { data, error } = await db.from("backup_file_copies").select("bucket, name, etag, size").range(from, from + 999);
            if (error) throw new Error(`Could not read the copy record: ${error.message}`);
            for (const r of data ?? []) copied.set(`${r.bucket}/${r.name}`, { etag: r.etag, size: Number(r.size) });
            if (!data || data.length < 1000) break;
          }
        }
        const queue = filesToCopy(stored, copied, weekly).map((f) => ({ b: f.bucket, n: f.name, s: f.size, e: f.etag, m: f.mimetype }));
        p.copy = { queue, index: 0, copied: 0, bytes: 0, failed: [] };
        await save();
      }
      const c = p.copy!;
      while (c.index < c.queue.length && timeLeft()) {
        const f = c.queue[c.index]!;
        try {
          const n = await copyStoredFile(db, sp, driveId, folderId, f);
          c.copied++;
          c.bytes += n;
          if (kind === "nightly") {
            const { error } = await db
              .from("backup_file_copies")
              .upsert({ bucket: f.b, name: f.n, etag: f.e, size: f.s, copied_at: new Date().toISOString(), run_id: runId });
            if (error) throw new Error(`Could not save the copy record: ${error.message}`);
          }
        } catch (e) {
          c.failed.push({ bucket: f.b, name: f.n, reason: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
        }
        c.index++;
        if (c.index % 10 === 0 || c.index === c.queue.length) await save({ files_copied: c.copied, bytes_copied: c.bytes });
      }
      if (c.index >= c.queue.length) {
        const stored = await listStoredFiles(db);
        const tonight = new Set(c.queue.map((q) => `${q.b}/${q.n}`));
        const failed = new Map(c.failed.map((f) => [`${f.bucket}/${f.name}`, f.reason]));
        const body = inventoryCsv(stored, tonight, failed, weekly);
        const bytes = text(body);
        await sp.put(driveId, folderId, INVENTORY_FILE, bytes, "text/csv");
        p.other_files = [
          ...(p.other_files ?? []).filter((f) => f.name !== INVENTORY_FILE),
          { name: INVENTORY_FILE, rows: stored.length, sha256: await sha256Hex(body), bytes: bytes.byteLength },
        ];
        const skipped = new Map<string, { bucket: string; files: number; bytes: number; reason: string }>();
        for (const f of stored) {
          const reason = notCopiedReason(f.bucket);
          if (!reason) continue;
          const s = skipped.get(f.bucket) ?? { bucket: f.bucket, files: 0, bytes: 0, reason };
          s.files++;
          s.bytes += f.size;
          skipped.set(f.bucket, s);
        }
        p.stored_files = { inventoried: stored.length, copied: c.copied, bytes_copied: c.bytes, failed: c.failed, not_copied: [...skipped.values()] };
        phase = "manifest";
        await save({ files_inventoried: stored.length, files_copied: c.copied, bytes_copied: c.bytes });
      }
    }

    if (phase === "manifest" && timeLeft()) {
      const manifest = buildExportManifest({
        folder,
        kind,
        weekly,
        started_at: startedAt,
        tables: p.done ?? [],
        other_files: p.other_files ?? [],
        stored_files: p.stored_files!,
      });
      const body = JSON.stringify(manifest, null, 2);
      await sp.put(driveId, folderId, MANIFEST_FILE, text(body), "application/json");
      p.manifest_sha256 = await sha256Hex(body);
      phase = "verify";
      await save({ manifest_sha256: p.manifest_sha256 });
    }

    if (phase === "verify" && timeLeft()) {
      const back = await sp.readText(driveId, folderId, MANIFEST_FILE);
      const matches = back !== null && (await sha256Hex(back)) === p.manifest_sha256;
      let manifest: ExportManifest | null = null;
      try {
        manifest = back ? (JSON.parse(back) as ExportManifest) : null;
      } catch {
        manifest = null;
      }
      const remoteSizes: Record<string, number> = {};
      for (const [n, s] of Object.entries(await sp.listSizes(driveId, p.tables_folder_id!))) remoteSizes[remoteKey(TABLES_FOLDER, n)] = s;
      for (const [n, s] of Object.entries(await sp.listSizes(driveId, folderId))) remoteSizes[remoteKey("", n)] = s;
      const live = Object.fromEntries((await listTables(db as never)).map((t) => [t.table_name, Number(t.row_count)]));
      const result = verifyExport({
        manifest,
        manifestMatches: matches,
        tablesAtStart: (p.tables_at_start ?? []).map((t) => t.table),
        remoteSizes,
        live,
      });
      phase = result.status === "passed" && kind === "nightly" ? "prune" : "done";
      await save({
        verify_status: result.status,
        verify_reasons: result.reasons,
        verify_result: result,
        verified_at: new Date().toISOString(),
        ...(phase === "done"
          ? { status: result.status === "passed" ? "succeeded" : "failed", finished_at: new Date().toISOString(), lease_until: null }
          : {}),
      });
      if (result.status === "failed" && alerts) {
        await alert(db, folder, "failed", `The nightly export for ${folder} did not pass its check: ${result.reasons.slice(0, 3).join(" ")}`);
      }
    }

    if (phase === "prune" && timeLeft()) {
      const prior = await db
        .from("backup_runs")
        .select("folder_name, folder_item_id, weekly")
        .eq("kind", "nightly")
        .not("folder_item_id", "is", null)
        .is("pruned_at", null);
      if (prior.error) throw new Error(`Reading the run log failed: ${prior.error.message}`);
      const created: KeptFolder[] = (prior.data ?? []).map((r: { folder_name: string; folder_item_id: string; weekly: boolean | null }) => ({
        name: r.folder_name,
        itemId: r.folder_item_id,
        weekly: r.weekly === true,
      }));
      let pruned = 0;
      for (const f of exportFoldersToPrune(created, settings)) {
        if (f.itemId === folderId) continue;
        await sp.remove(driveId, f.itemId);
        await db.from("backup_runs").update({ pruned_at: new Date().toISOString() }).eq("folder_item_id", f.itemId);
        pruned++;
      }
      phase = "done";
      await save({ status: "succeeded", finished_at: new Date().toISOString(), pruned_count: pruned, lease_until: null });
    }

    if (phase !== "done") {
      p.failed_calls = 0;
      await save({ lease_until: null });
    }
    return { ok: true, runId, folder, phase };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    p.failed_calls = (p.failed_calls ?? 0) + 1;
    p.last_error = error.slice(0, 500);
    const giveUp = p.failed_calls >= MAX_FAILED_CALLS;
    await db
      .from("backup_runs")
      .update({
        progress: p,
        error: error.slice(0, 1000),
        lease_until: null,
        ...(giveUp ? { phase: "done", status: "failed", verify_status: "failed", verify_reasons: [error.slice(0, 300)], finished_at: new Date().toISOString() } : {}),
      })
      .eq("id", runId);
    if (giveUp && alerts) {
      try {
        await alert(db, folder, "failed", `The nightly export for ${folder} stopped: ${error}`);
      } catch {
        // The 5 a.m. check still alerts for a night that did not pass.
      }
    }
    return { ok: false, runId, folder, error };
  }
}

/** Test only: remove a test run's folder from SharePoint and mark it removed. Never a dated folder. */
export async function removeTestExportFolder(db: Db, runId: string, io?: SharePointIo) {
  const { data, error } = await db.from("backup_runs").select("folder_name, folder_item_id, kind, progress").eq("id", runId).single();
  if (error || !data) throw new Error("That run was not found.");
  if (data.kind !== "test" || !String(data.folder_name).startsWith(TEST_FOLDER_PREFIX)) throw new Error("Only a test folder can be removed.");
  let sp = io;
  if (!sp) {
    const key = await getServiceSharePointConnectionKey();
    if (!key) throw new Error("Resolve's SharePoint integration is not connected.");
    sp = realSharePoint(key);
  }
  const driveId = (data.progress as Progress | null)?.drive_id ?? (await sp.root()).driveId;
  if (data.folder_item_id) await sp.remove(driveId, data.folder_item_id);
  await db.from("backup_runs").update({ pruned_at: new Date().toISOString() }).eq("id", runId);
  return { ok: true as const };
}
