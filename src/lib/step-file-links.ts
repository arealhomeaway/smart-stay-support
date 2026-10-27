/**
 * Files flow between steps (Help Ticket #55) — pure rules, no database.
 *
 * A receiving Task SHOWS the current files of its source Tasks on the same
 * home. Nothing is copied: the list is read live, so a replaced file shows
 * the latest and a removed file disappears. Only the source's OWN uploads
 * appear (one hop), receivers never delete, and only internal staff see it.
 */

export type LinkTask = { id: string; property_id: string; title: string; archived_at: string | null };
export type LinkRow = { receiving_task_id: string; source_task_id: string; property_id: string; removed_at: string | null };
export type SourceFile = {
  id: string;
  entity_type: string;
  entity_id: string;
  original_filename: string | null;
  title: string;
  uploaded_by_name: string | null;
  uploaded_at: string | null;
  created_at: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
};
export type LinkedFile = SourceFile & { can_delete: false; can_share: false };
export type LinkedSection = {
  sourceTaskId: string;
  sourceTitle: string;
  removed: boolean;
  files: LinkedFile[];
};

const STAFF_ROLES = ["admin", "manager", "onboarding", "tech"];

/** Linked files are internal only — never homeowners or vendors. */
export function linkedFilesAllowed(roles: readonly string[]) {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

/** Validate a hand-made or template link set before it is saved. */
export function validateSources(
  receiving: Pick<LinkTask, "id" | "property_id">,
  sourceIds: readonly string[],
  candidates: readonly Pick<LinkTask, "id" | "property_id" | "archived_at">[],
): { ok: true; ids: string[] } | { ok: false; reason: string } {
  const ids = [...new Set(sourceIds)];
  if (ids.includes(receiving.id)) return { ok: false, reason: "A step cannot show files from itself." };
  for (const id of ids) {
    const c = candidates.find((t) => t.id === id);
    if (!c || c.property_id !== receiving.property_id || c.archived_at)
      return { ok: false, reason: "Steps can only show files from Tasks on the same home." };
  }
  return { ok: true, ids };
}

/** Template step ids → home Task ids, only among Tasks created for one home. */
export function resolveTemplateLinks(
  steps: readonly { id: string; show_files_from?: readonly string[] | null }[],
  createdTaskByStep: ReadonlyMap<string, string>,
): { receiving_task_id: string; source_task_id: string }[] {
  const out: { receiving_task_id: string; source_task_id: string }[] = [];
  for (const s of steps) {
    const recv = createdTaskByStep.get(s.id);
    if (!recv) continue;
    for (const src of new Set(s.show_files_from ?? [])) {
      const source = createdTaskByStep.get(src);
      if (source && src !== s.id) out.push({ receiving_task_id: recv, source_task_id: source });
    }
  }
  return out;
}

/**
 * Build the "Files from …" sections for one receiving Task.
 * `filesBySource` must already be the files the viewer may see on each source
 * (the same list the source Task shows them).
 */
export function buildLinkedSections(
  receiving: Pick<LinkTask, "id" | "property_id">,
  links: readonly LinkRow[],
  sources: readonly LinkTask[],
  filesBySource: ReadonlyMap<string, readonly SourceFile[]>,
): LinkedSection[] {
  const seen = new Set<string>();
  const out: LinkedSection[] = [];
  for (const l of links) {
    if (l.removed_at || l.receiving_task_id !== receiving.id) continue;
    if (l.source_task_id === receiving.id || seen.has(l.source_task_id)) continue;
    const src = sources.find((s) => s.id === l.source_task_id);
    if (!src || src.property_id !== receiving.property_id || l.property_id !== receiving.property_id) continue;
    seen.add(src.id);
    if (src.archived_at) {
      out.push({ sourceTaskId: src.id, sourceTitle: src.title, removed: true, files: [] });
      continue;
    }
    const files = (filesBySource.get(src.id) ?? [])
      // One hop only: the source's own uploads, never what it shows from elsewhere.
      .filter((f) => f.entity_type === "onboarding_task" && f.entity_id === src.id)
      .map((f) => ({ ...f, can_delete: false as const, can_share: false as const }));
    out.push({ sourceTaskId: src.id, sourceTitle: src.title, removed: false, files });
  }
  return out;
}
