/**
 * Pure bucketing for the Owner view preview. Mirrors the portal's rules:
 * a Draft Opportunity is internal (and hides any approval on its Task);
 * owners only see approvals ARHA deliberately published.
 */
export type PreviewItem = { id: string; title: string; detail: string | null; kind: string };

/** Categories the owner portal never shows, whatever their content. */
export const INTERNAL_ONLY = [
  "Assessments and their findings",
  "Internal notes and Task comments",
  "Vendor discussions and Work Orders",
  "Expenses and Finance files",
  "Credentials and access codes",
];

type Item = {
  id: string;
  title: string;
  owner_content: unknown;
  status: string;
  source: string | null;
  source_task_id: string | null;
  program_id?: string | null;
};
type Pub = { id: string; title: string; detail: string | null; entity_id: string | null };

function text(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["summary", "body", "message", "description"]) if (typeof o[k] === "string") return o[k] as string;
  }
  return null;
}

export function ownerPreviewBuckets(all: Item[], pubs: Pub[]) {
  // Same as the owner read rule: never archived, and only inside an owner program.
  const items = all.filter((i) => i.status !== "archived" && i.program_id !== null);
  const drafts = items.filter((i) => i.status === "draft");
  const draftTasks = new Set(drafts.map((d) => d.source_task_id).filter(Boolean) as string[]);
  const visible: PreviewItem[] = [
    ...items
      .filter((i) => i.status !== "draft")
      .map((i) => ({ id: i.id, title: i.title, detail: text(i.owner_content), kind: "Opportunity" })),
    ...pubs
      .filter((p) => !p.entity_id || !draftTasks.has(p.entity_id))
      .map((p) => ({ id: p.id, title: p.title, detail: p.detail, kind: "Approval" })),
  ];
  return {
    visible,
    draft: drafts.map((d) => ({ id: d.id, title: d.title, detail: text(d.owner_content), kind: "Draft Opportunity" })),
    internalOnly: INTERNAL_ONLY,
  };
}
