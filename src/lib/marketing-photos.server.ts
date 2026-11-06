import { Zip, ZipPassThrough } from "fflate";
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getServiceSharePointConnectionKey } from "./sharepoint-connection.server";
import { ARHA_RESOLVE_SITE_PATH, SHAREPOINT_CONNECTOR_ID, SHAREPOINT_GATEWAY_BASE_URL } from "./sharepoint";
import { isPhotoFile, marketingPhotosFolderPath, zipEntryNames, type PhotoFile, type PhotoHome } from "./marketing-photos";

/** Read-only view of one home's Marketing Photos folder. Never creates folders. */
export type PhotoSource = {
  list(home: PhotoHome): Promise<{ files: PhotoFile[] | null; webUrl: string | null; hasPath: boolean }>;
  open(fileId: string): Promise<ReadableStream<Uint8Array>>;
};

export async function sharePointPhotoSource(): Promise<PhotoSource> {
  const key = await getServiceSharePointConnectionKey();
  if (!key) throw new Error("SharePoint is unavailable. Check Admin > Integrations.");
  const call = (path: string) =>
    callAsAppUser({ gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL, connectorId: SHAREPOINT_CONNECTOR_ID, connectionAPIKey: key, path });
  const graph = async (path: string) => {
    const response = await call(path);
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text();
      console.error(`Marketing photos SharePoint [${response.status}]: ${body}`);
      throw new Error(`SharePoint [${response.status}]`);
    }
    return response.json();
  };
  let driveId: string | null = null;
  const drive = async () => {
    if (driveId) return driveId;
    const d = await graph(`${ARHA_RESOLVE_SITE_PATH}:/drive?$select=id,name`);
    if (!d || d.name !== "Documents") throw new Error("The Documents library could not be found.");
    driveId = String(d.id);
    return driveId;
  };
  return {
    async list(home) {
      const path = marketingPhotosFolderPath(home);
      if (!path) return { files: null, webUrl: null, hasPath: false };
      const id = await drive();
      const encoded = path.split("/").map(encodeURIComponent).join("/");
      const folder = await graph(`/drives/${id}/root:/${encoded}?$select=id,webUrl,folder`);
      if (!folder?.folder) return { files: null, webUrl: null, hasPath: true };
      const files: PhotoFile[] = [];
      let next: string | null = `/drives/${id}/items/${folder.id}/children?$select=id,name,size,lastModifiedDateTime,file&$top=999`;
      while (next) {
        const page = await graph(next);
        for (const item of page?.value ?? []) {
          if (item.file) files.push({ id: String(item.id), name: String(item.name), size: Number(item.size ?? 0), modified: item.lastModifiedDateTime ?? null });
        }
        const link: string | undefined = page?.["@odata.nextLink"];
        next = link ? link.replace(/^https:\/\/graph\.microsoft\.com\/v1\.0/, "") : null;
      }
      return { files, webUrl: String(folder.webUrl ?? "") || null, hasPath: true };
    },
    async open(fileId) {
      const response = await call(`/drives/${await drive()}/items/${fileId}/content`);
      if (!response.ok || !response.body) {
        console.error(`Marketing photo download [${response.status}]: ${await response.text()}`);
        throw new Error("A photo could not be read from SharePoint.");
      }
      return response.body;
    },
  };
}

/**
 * Streams one zip of the photos without holding the archive in memory.
 * Pull-driven: the next photo chunk is read only when the browser takes more
 * output, so memory stays near one chunk. Photos are stored, not recompressed.
 */
export function streamPhotoZip(files: PhotoFile[], open: PhotoSource["open"]): ReadableStream<Uint8Array> {
  const photos = files.filter((f) => isPhotoFile(f.name));
  const names = zipEntryNames(photos.map((f) => f.name));
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let failed: Error | null = null;
  const zip = new Zip((err, chunk, final) => {
    if (err) { failed = err as Error; return; }
    if (chunk.length) controllerRef?.enqueue(chunk);
    if (final) controllerRef?.close();
  });
  let index = 0;
  let entry: ZipPassThrough | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let ended = false;
  return new ReadableStream<Uint8Array>({
    start(controller) { controllerRef = controller; },
    async pull(controller) {
      try {
        while (!ended) {
          if (failed) throw failed;
          if (!reader) {
            if (index >= photos.length) { ended = true; zip.end(); return; }
            const file = photos[index]!;
            entry = new ZipPassThrough(names[index]!);
            if (file.modified) entry.mtime = new Date(file.modified);
            zip.add(entry);
            reader = (await open(file.id)).getReader();
          }
          const { done, value } = await reader.read();
          if (done) {
            entry!.push(new Uint8Array(0), true);
            reader = null; entry = null; index += 1;
            continue;
          }
          entry!.push(value);
          if ((controller.desiredSize ?? 1) <= 0) return;
          return;
        }
      } catch (e) {
        zip.terminate();
        controller.error(e instanceof Error ? e : new Error(String(e)));
      }
    },
    cancel() { zip.terminate(); void reader?.cancel(); },
  });
}

/** Owners reach only homes they own; staff reach any home. Decided before SharePoint is read. */
export function decidePhotoAccess(viewer: { isStaff: boolean; ownsHome: boolean; signedIn: boolean }) {
  if (!viewer.signedIn) return { allow: false as const, reason: "Sign in to download photos." };
  if (viewer.isStaff || viewer.ownsHome) return { allow: true as const };
  return { allow: false as const, reason: "You do not have access to this home's photos." };
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Logs the download (who, when, home) and returns a single-use, two-minute
 * link. Only the token's hash is stored.
 */
export async function startPhotoDownloadCore(deps: {
  propertyId: string;
  count: number;
  bytes: number;
  log: (args: { _property_id: string; _token_hash: string; _file_count: number; _total_bytes: number }) => Promise<{ error: { message: string } | null }>;
  token?: string;
}) {
  const token = deps.token ?? `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const { error } = await deps.log({ _property_id: deps.propertyId, _token_hash: await sha256Hex(token), _file_count: deps.count, _total_bytes: deps.bytes });
  if (error) throw new Error("The download could not be started. Nothing was downloaded.");
  return { url: `/api/public/marketing-photos/${token}` };
}
