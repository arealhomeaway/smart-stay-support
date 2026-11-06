/**
 * Marketing photos: one SharePoint folder per home in the ARHA Resolve site.
 * Pure rules only (browser safe). Reading and zipping live in
 * marketing-photos.server.ts; owners never get SharePoint access.
 */

/** Cards whose owner work uses the home's marketing photos. */
export const PHOTO_CARD_CODES = ["P07", "P08", "P12", "P13", "P14", "P15", "P20"] as const;

export function isPhotoCard(code: string | null | undefined) {
  return Boolean(code && (PHOTO_CARD_CODES as readonly string[]).includes(code));
}

/** Plan steps where staff handle the home's marketing photos. */
export function isPhotoStep(title: string | null | undefined) {
  return /\bphotos?\b/i.test(title ?? "") && /(confirm|download|upload|share|marketing|shoot|photographer)/i.test(title ?? "");
}

/** Safety caps for one download. Larger sets are refused, never truncated silently. */
export const PHOTO_ZIP_LIMITS = { maxFiles: 600, maxBytes: 3 * 1024 * 1024 * 1024 } as const;

const IMAGE = /\.(jpe?g|png|heic|heif|webp|tiff?|gif)$/i;
export function isPhotoFile(name: string) {
  return IMAGE.test(name);
}

/** SharePoint forbids " * : < > ? / \ | and trailing dots/spaces in names. */
function safeSegment(value: string) {
  return value.replace(/["*:<>?/\\|#%]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
}

export type PhotoHome = { address_line1: string | null; name: string | null; ownerrez_property_id: string | number | null };

/** Documents/Homes/<address> (<OwnerRez ID>)/Marketing Photos, relative to the library root. */
export function marketingPhotosFolderPath(home: PhotoHome): string | null {
  const address = safeSegment(home.address_line1 || home.name || "");
  const ownerRez = safeSegment(String(home.ownerrez_property_id ?? ""));
  if (!address || !ownerRez) return null;
  return `Homes/${address} (${ownerRez})/Marketing Photos`;
}

export type PhotoFile = { id: string; name: string; size: number; modified: string | null };

export type PhotoSummary =
  | { ready: true; count: number; bytes: number; updatedAt: string | null; tooLarge: boolean }
  | { ready: false; reason: "missing" | "empty" | "no_folder_name" };

export function summarizePhotos(files: PhotoFile[] | null, hasPath = true): PhotoSummary {
  if (!hasPath) return { ready: false, reason: "no_folder_name" };
  if (files === null) return { ready: false, reason: "missing" };
  const photos = files.filter((f) => isPhotoFile(f.name));
  if (photos.length === 0) return { ready: false, reason: "empty" };
  const bytes = photos.reduce((s, f) => s + f.size, 0);
  const updatedAt = photos.map((f) => f.modified).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  return {
    ready: true,
    count: photos.length,
    bytes,
    updatedAt,
    tooLarge: photos.length > PHOTO_ZIP_LIMITS.maxFiles || bytes > PHOTO_ZIP_LIMITS.maxBytes,
  };
}

export const PHOTOS_NOT_READY = "Photos aren't ready yet";

/** Unique zip entry names; duplicates get " (2)", " (3)". */
export function zipEntryNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const k = (seen.get(key) ?? 0) + 1;
    seen.set(key, k);
    if (k === 1) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)} (${k})${n.slice(dot)}` : `${n} (${k})`;
  });
}
