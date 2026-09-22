/**
 * Editable onboarding templates (browser-safe shaping).
 *
 * The built-in ARHA plan lives in code (onboarding-template.ts). A team-authored
 * template lives in the database. Both are normalised into the SAME
 * `TemplateTask[]` shape here, so applying a plan, dating it and deduplicating
 * it stay one code path.
 */

import { MASTER_ONBOARDING_TEMPLATE, type TemplateTask } from "./onboarding-template";

export const BUILT_IN_TEMPLATE_KEY = "arha_full_furnishing";

export type TemplateTaskRow = {
  id: string;
  template_id: string;
  stage: string;
  title: string;
  role: string | null;
  detail: string | null;
  sort_order: number;
  blocks_handoff: boolean;
  requires_owner_approval: boolean;
  owner_approval_when_active_owner: boolean;
  evidence_required: boolean;
  schedule_anchor: string | null;
  offset_days: number | null;
  breezeway_template_id: string | null;
  subtasks: string[] | null;
};

export type TemplateRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_archived: boolean;
};

export type TemplateSummary = {
  id: string | null;
  key: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isArchived: boolean;
  builtIn: boolean;
  taskCount: number;
  subtaskCount: number;
};

const ANCHORS = ["planned_closing", "actual_closing", "actual_access"] as const;
type Anchor = (typeof ANCHORS)[number];

function anchorOf(value: string | null): Anchor | undefined {
  return ANCHORS.includes((value ?? "") as Anchor) ? (value as Anchor) : undefined;
}

/** One saved template row -> the shape the apply/preview engine already speaks. */
export function toTemplateTask(row: TemplateTaskRow): TemplateTask {
  const anchor = anchorOf(row.schedule_anchor);
  const task: TemplateTask = {
    key: row.id,
    stage: row.stage,
    title: row.title,
    role: row.role ?? "",
    blocksHandoff: row.blocks_handoff,
    sortOrder: row.sort_order,
  };
  if (row.detail) task.detail = row.detail;
  if (row.requires_owner_approval) task.requiresOwnerApproval = true;
  if (row.owner_approval_when_active_owner) task.ownerApprovalWhenActiveOwner = true;
  if (row.evidence_required) task.evidenceRequired = true;
  if (anchor && row.offset_days !== null) {
    task.anchor = anchor;
    task.offsetDays = row.offset_days;
  }
  if (row.breezeway_template_id) task.breezewayTemplateId = row.breezeway_template_id;
  const subs = (row.subtasks ?? []).map((s) => s.trim()).filter(Boolean);
  if (subs.length) task.subtasks = subs;
  return task;
}

/** Whole saved template -> ordered TemplateTask[]. */
export function toTemplateTasks(rows: TemplateTaskRow[]): TemplateTask[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
    .map(toTemplateTask);
}

/** The built-in plan, described the same way a saved one is. */
export function builtInSummary(): TemplateSummary {
  return {
    id: null,
    key: BUILT_IN_TEMPLATE_KEY,
    name: "ARHA Full Furnishing",
    description:
      "The standard ARHA onboarding plan. Edit it here — homes started from it get your version.",
    isDefault: false,
    isArchived: false,
    builtIn: true,
    taskCount: MASTER_ONBOARDING_TEMPLATE.length,
    subtaskCount: MASTER_ONBOARDING_TEMPLATE.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0),
  };
}

/** Insert rows for a copy of the built-in plan. */
export function builtInAsRows(templateId: string) {
  return MASTER_ONBOARDING_TEMPLATE.map((t, i) => ({
    template_id: templateId,
    stage: t.stage,
    title: t.title,
    role: t.role || null,
    detail: t.detail ?? null,
    sort_order: t.sortOrder ?? i,
    blocks_handoff: t.blocksHandoff,
    requires_owner_approval: Boolean(t.requiresOwnerApproval),
    owner_approval_when_active_owner: Boolean(t.ownerApprovalWhenActiveOwner),
    evidence_required: Boolean(t.evidenceRequired),
    schedule_anchor: t.anchor ?? null,
    offset_days: t.offsetDays ?? null,
    breezeway_template_id: t.breezewayTemplateId ?? null,
    subtasks: t.subtasks ?? [],
  }));
}

/** URL/db key from a human name, kept unique by the caller. */
export function templateKeyFrom(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || "template";
}
