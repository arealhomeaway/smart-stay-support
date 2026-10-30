/**
 * Sends one file to a signed upload slot in the shared Resolve file store,
 * reporting progress so large videos never look frozen. Same slot, same
 * access rules as before — only the transport reports progress.
 */
import { ATTACHMENT_BUCKET } from "./attachments";

export function uploadToSignedSlot(
  path: string,
  token: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const base = import.meta.env["VITE_SUPABASE_URL"] as string;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const url = `${base}/storage/v1/object/upload/sign/${ATTACHMENT_BUCKET}/${encoded}?token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new Error(`Storage refused ${file.name} as too large. Files up to 250 MB can be uploaded; for anything bigger, add a link instead.`));
      else reject(new Error(`${file.name} did not finish uploading (storage answered ${xhr.status}). Select Retry.`));
    };
    xhr.onerror = () => reject(new Error(`${file.name} lost its connection while uploading. Check your connection, then select Retry.`));
    xhr.send(file);
  });
}
