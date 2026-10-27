/** Optional Library walkthrough videos: one rule for what may be uploaded and how playback links refresh. */

export const LIBRARY_VIDEO_BUCKET = "resolve-attachments";
export const LIBRARY_VIDEO_MAX_BYTES = 250 * 1024 * 1024; // matches the bucket's 250 MB cap
export const LIBRARY_VIDEO_DEFAULT_LABEL = "Watch the walkthrough";
/** Playback links are short-lived; the player asks for a fresh one before or when this runs out. */
export const LIBRARY_VIDEO_URL_SECONDS = 30 * 60;
export const LIBRARY_VIDEO_REFRESH_MARGIN_MS = 2 * 60 * 1000;

export const LIBRARY_VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;
export type LibraryVideoMime = keyof typeof LIBRARY_VIDEO_TYPES;

const EXT_TO_MIME: Record<string, LibraryVideoMime> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/** Browsers sometimes leave `type` blank (notably .mov on Windows); fall back to the extension. */
export function resolveVideoMime(file: { name: string; type: string }): LibraryVideoMime | null {
  if (file.type in LIBRARY_VIDEO_TYPES) return file.type as LibraryVideoMime;
  if (file.type && !file.type.startsWith("video/") && file.type !== "application/octet-stream") return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export function validateVideoFile(file: { name: string; type: string; size: number }):
  | { ok: true; mime: LibraryVideoMime }
  | { ok: false; reason: string } {
  const mime = resolveVideoMime(file);
  if (!mime) return { ok: false, reason: "Choose an MP4, MOV or WebM video." };
  if (!(file.size > 0)) return { ok: false, reason: "That file is empty." };
  if (file.size > LIBRARY_VIDEO_MAX_BYTES) return { ok: false, reason: "Videos can be up to 250 MB." };
  return { ok: true, mime };
}

export function libraryVideoPath(libraryId: string, fileId: string, mime: LibraryVideoMime) {
  return `owner-library-video/${libraryId}/${fileId}.${LIBRARY_VIDEO_TYPES[mime]}`;
}

export function isLibraryVideoPath(libraryId: string, path: string) {
  return path.startsWith(`owner-library-video/${libraryId}/`) && !path.includes("..");
}

/** True when a playback link should be replaced now. */
export function shouldRefreshSignedUrl(expiresAtMs: number, nowMs: number) {
  return expiresAtMs - nowMs <= LIBRARY_VIDEO_REFRESH_MARGIN_MS;
}

/** Milliseconds until the player should fetch a new link (never negative). */
export function msUntilRefresh(expiresAtMs: number, nowMs: number) {
  return Math.max(0, expiresAtMs - nowMs - LIBRARY_VIDEO_REFRESH_MARGIN_MS);
}

/** The video is always read from the current library item, never from a started copy. */
export function videoForOpportunity<T>(libraryTemplateId: string | null | undefined, index: Map<string, T>): T | null {
  return libraryTemplateId ? index.get(libraryTemplateId) ?? null : null;
}

export function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
