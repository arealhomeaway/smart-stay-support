/** Pure helpers for the read-only property Files tab. */
export type FileKind = "document" | "photo" | "link";
export type FileRow = {
  id: string;
  name: string;
  kind: FileKind;
  detail: string | null;
  createdAt: string;
  url: string | null;
};

const PHOTO_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i;

export function fileKind(input: { mime?: string | null; filename?: string | null }): FileKind {
  if ((input.mime ?? "").toLowerCase().startsWith("image/")) return "photo";
  if (PHOTO_EXT.test(input.filename ?? "")) return "photo";
  return "document";
}

const KIND_WORDS: Record<FileKind, string> = { document: "document", photo: "photo", link: "link" };

/** Search matches name, detail or the type word; kind narrows to one type. */
export function filterFiles(rows: FileRow[], query: string, kind: FileKind | "all"): FileRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (kind !== "all" && r.kind !== kind) return false;
    if (!needle) return true;
    return `${r.name} ${r.detail ?? ""} ${KIND_WORDS[r.kind]}`.toLowerCase().includes(needle);
  });
}
