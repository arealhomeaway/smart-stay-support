/**
 * Nightly backup: exports Operations, finance and onboarding records to dated
 * CSV folders in the ARHA Resolve site's Documents library, using only
 * Resolve's own SharePoint integration (resolve.integration@arealhomeaway.com).
 *
 * Writes nothing to Resolve records except its own run log and, on failure,
 * in-app alerts to Admins. Retention only deletes dated folders it created.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getServiceSharePointConnectionKey } from "@/lib/sharepoint-connection.server";
import {
  ARHA_RESOLVE_SITE_PATH,
  SHAREPOINT_CONNECTOR_ID,
  SHAREPOINT_GATEWAY_BASE_URL,
} from "@/lib/sharepoint";
import {
  BACKUP_EXPORTS,
  BACKUP_ROOT_FOLDER,
  backupFolderName,
  toCsv,
} from "@/lib/nightly-backup";

type Db = { from: (t: string) => any };
const PAGE = 1000;
const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024;
const CHUNK = 320 * 1024 * 16; // 5 MiB, a multiple of 320 KiB as Graph requires

async function graph(key: string, path: string, init?: RequestInit) {
  const res = await callAsAppUser({
    gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL,
    connectorId: SHAREPOINT_CONNECTOR_ID,
    connectionAPIKey: key,
    path,
    ...(init ? { init } : {}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SharePoint ${init?.method ?? "GET"} failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function readAll(db: Db, table: string, orderBy = "id"): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function ensureFolder(key: string, driveId: string, parentId: string, name: string) {
  const enc = encodeURIComponent(name);
  try {
    return (await graph(key, `/drives/${driveId}/items/${parentId}:/${enc}?$select=id,name,folder`)) as {
      id: string;
    };
  } catch (e) {
    if (!String(e).includes("[404]")) throw e;
  }
  return (await graph(key, `/drives/${driveId}/items/${parentId}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
  })) as { id: string };
}

async function upload(key: string, driveId: string, folderId: string, name: string, text: string) {
  const bytes = new TextEncoder().encode(text);
  const target = `/drives/${driveId}/items/${folderId}:/${encodeURIComponent(name)}:`;
  if (bytes.byteLength <= SIMPLE_UPLOAD_MAX) {
    await graph(key, `${target}/content`, {
      method: "PUT",
      headers: { "Content-Type": "text/csv" },
      body: bytes,
    });
    return bytes.byteLength;
  }
  const session = (await graph(key, `${target}/createUploadSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
  })) as { uploadUrl: string };
  for (let start = 0; start < bytes.byteLength; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.byteLength);
    // The pre-authenticated upload URL is sent straight to Microsoft, without credentials.
    const res = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(end - start),
        "Content-Range": `bytes ${start}-${end - 1}/${bytes.byteLength}`,
      },
      body: bytes.slice(start, end),
    });
    if (!res.ok && res.status !== 202) {
      throw new Error(`Upload of ${name} failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
    }
  }
  return bytes.byteLength;
}

async function alertAdmins(db: Db, message: string) {
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  if (!ids.length) return;
  await db.from("staff_notifications").insert(
    ids.map((user_id) => ({
      user_id,
      kind: "backup_failed",
      title: "Nightly backup failed",
      body: message.slice(0, 500),
      link_path: "/integrations",
      priority: "high",
    })),
  );
}

export type BackupResult =
  | { ok: true; skipped: string }
  | { ok: true; runId: string; folder: string; files: number; pruned: number }
  | { ok: false; runId: string | null; error: string };

export async function runNightlyBackup(db: Db, now = new Date(), trigger = "schedule"): Promise<BackupResult> {
  const folder = backupFolderName(now);

  const done = await db
    .from("backup_runs")
    .select("id")
    .eq("folder_name", folder)
    .eq("status", "succeeded")
    .limit(1);
  if (done.error) return { ok: false, runId: null, error: `Run log unavailable: ${done.error.message}` };
  if (done.data?.length) return { ok: true, skipped: `Backup for ${folder} already done` };

  const started = await db
    .from("backup_runs")
    .insert({ folder_name: folder, status: "running", trigger })
    .select("id")
    .single();
  if (started.error) return { ok: false, runId: null, error: `Run log unavailable: ${started.error.message}` };
  const runId = started.data.id as string;

  const files: { file: string; rows: number; bytes: number }[] = [];
  let folderItemId: string | null = null;
  try {
    const key = await getServiceSharePointConnectionKey();
    if (!key) throw new Error("Resolve's SharePoint integration is not connected.");
    const drive = (await graph(key, `${ARHA_RESOLVE_SITE_PATH}:/drive?$select=id`)) as { id: string };
    const root = (await graph(key, `/drives/${drive.id}/root?$select=id`)) as { id: string };
    const top = await ensureFolder(key, drive.id, root.id, BACKUP_ROOT_FOLDER);
    const dated = await ensureFolder(key, drive.id, top.id, folder);
    folderItemId = dated.id;
    await db.from("backup_runs").update({ folder_item_id: folderItemId }).eq("id", runId);

    for (const exp of BACKUP_EXPORTS) {
      const rows = await readAll(db, exp.table, "orderBy" in exp ? exp.orderBy : "id");
      const bytes = await upload(key, drive.id, dated.id, exp.file, toCsv(rows));
      files.push({ file: exp.file, rows: rows.length, bytes });
    }

    // Removing old folders now belongs to the full nightly export (30 nightly and 12 weekly
    // folders kept, register N10), so this manual run never removes a folder the export keeps.
    const pruned = 0;

    await db
      .from("backup_runs")
      .update({ status: "succeeded", finished_at: new Date().toISOString(), files, pruned_count: pruned })
      .eq("id", runId);
    return { ok: true, runId, folder, files: files.length, pruned };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db
      .from("backup_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), files, error })
      .eq("id", runId);
    await alertAdmins(db, `Backup for ${folder} did not finish: ${error}`);
    return { ok: false, runId, error };
  }
}
