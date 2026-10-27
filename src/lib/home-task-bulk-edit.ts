/**
 * Browser-safe planning for bulk edits on ONE home's onboarding plan.
 *
 * The database action re-checks every rule before writing; this planner only
 * decides which Tasks may be selected and gives an accurate preview.
 */
import { handoffLocked } from "./template-step-dialog";

export type HomeBulkTask = {
  id: string;
  title: string;
  stage: string;
  status: string;
  sort_order?: number | null;
  archived_at?: string | null;
  exception_at?: string | null;
  exception_reason?: string | null;
  due_on: string | null;
  due_on_overridden?: boolean | null;
  schedule_offset_unit?: string | null;
  assigned_seat: string | null;
  is_required?: boolean | null;
  blocks_handoff: boolean;
  requires_owner_approval: boolean;
  tags?: string[] | null;
};

export type HomeBulkPatch = {
  dueOn?: string;
  offsetUnit?: "calendar" | "business";
  role?: string | null;
  isRequired?: boolean;
  blocksHandoff?: boolean;
  stage?: string;
};

export type HomeBulkPlan =
  | {
      ok: true;
      changed: { taskId: string; title: string }[];
      skipped: { taskId: string; title: string; reason: string }[];
      summary: string[];
      handoffSkipMessage: string | null;
      readiness: { before: boolean; after: boolean; message: string | null };
    }
  | { ok: false; error: string };

export const HOME_HANDOFF_SKIP_REASON = "Homeowner or Active Owner Tasks are left as non-blocking.";
export const HOME_MANUAL_DATE_NOTE = "These dates won't move automatically if the closing date changes.";

const DONE = new Set(["complete", "done", "carryover"]);

/** Completed, carried-over, voided and exception Tasks never get a checkbox. */
export function homeTaskSelectable(task: HomeBulkTask) {
  return !DONE.has(task.status) && !task.archived_at && !task.exception_at && !task.exception_reason;
}

/** Same rule as the handoff panel: open, required, blocking Tasks hold the home back. */
export function homeBlockingCount(tasks: HomeBulkTask[]) {
  return tasks.filter(
    (t) => !t.archived_at && t.blocks_handoff && t.is_required !== false && t.status !== "complete" && t.status !== "done",
  ).length;
}

function patchParts(patch: HomeBulkPatch, roleName: (code: string | null) => string, dateLabel: (d: string) => string) {
  const parts: string[] = [];
  if (patch.dueOn) parts.push(`due date to ${dateLabel(patch.dueOn)}`);
  if (patch.offsetUnit) parts.push(patch.offsetUnit === "business" ? "business days" : "calendar days");
  if (patch.role !== undefined) parts.push(`assigned role to ${roleName(patch.role)}`);
  if (patch.isRequired !== undefined) parts.push(patch.isRequired ? "Required" : "Optional");
  if (patch.blocksHandoff !== undefined) parts.push(`Blocks handoff: ${patch.blocksHandoff ? "Yes" : "No"}`);
  if (patch.stage) parts.push(`stage to ${patch.stage}`);
  return parts;
}

export function planHomeTaskBulkEdit(
  tasks: HomeBulkTask[],
  selectedIds: string[],
  patch: HomeBulkPatch,
  options: { stages: string[]; roleName?: (code: string | null) => string; dateLabel?: (d: string) => string },
): HomeBulkPlan {
  const roleName = options.roleName ?? ((code) => code ?? "Unassigned");
  const dateLabel = options.dateLabel ?? ((d) => d);
  if (!selectedIds.length) return { ok: false, error: "Select at least one Task." };
  if (!Object.keys(patch).length) return { ok: false, error: "Choose at least one change." };
  if (patch.dueOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dueOn)) return { ok: false, error: "Pick a due date." };
  if (patch.role === "owner") return { ok: false, error: "Owner is not an internal assigned role." };
  if (patch.stage !== undefined && !options.stages.includes(patch.stage))
    return { ok: false, error: "Choose a stage already on this home's plan." };

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const blocked: string[] = [];
  for (const id of selectedIds) {
    const t = byId.get(id);
    if (!t) return { ok: false, error: "Some selected Tasks are no longer on this plan. Refresh and try again." };
    if (!homeTaskSelectable(t)) blocked.push(t.title);
  }
  if (blocked.length) return { ok: false, error: `These Tasks cannot be edited: ${blocked.join("; ")}` };

  const skipped: { taskId: string; title: string; reason: string }[] = [];
  const changed: { taskId: string; title: string }[] = [];
  const next = new Map(tasks.map((t) => [t.id, t]));
  for (const id of selectedIds) {
    const t = byId.get(id)!;
    const skipBlocks = patch.blocksHandoff === true && handoffLocked({ requires_owner_approval: t.requires_owner_approval, tags: t.tags ?? [] });
    if (skipBlocks) skipped.push({ taskId: t.id, title: t.title, reason: HOME_HANDOFF_SKIP_REASON });
    const after: HomeBulkTask = {
      ...t,
      due_on: patch.dueOn ?? t.due_on,
      due_on_overridden: patch.dueOn ? true : t.due_on_overridden,
      schedule_offset_unit: patch.offsetUnit ?? t.schedule_offset_unit,
      assigned_seat: patch.role !== undefined ? patch.role : t.assigned_seat,
      is_required: patch.isRequired ?? t.is_required,
      blocks_handoff: patch.blocksHandoff !== undefined && !skipBlocks ? patch.blocksHandoff : t.blocks_handoff,
      stage: patch.stage ?? t.stage,
    };
    const differs =
      after.due_on !== t.due_on ||
      Boolean(after.due_on_overridden) !== Boolean(t.due_on_overridden) ||
      (after.schedule_offset_unit ?? "calendar") !== (t.schedule_offset_unit ?? "calendar") ||
      after.assigned_seat !== t.assigned_seat ||
      after.is_required !== t.is_required ||
      after.blocks_handoff !== t.blocks_handoff ||
      after.stage !== t.stage;
    if (differs) {
      changed.push({ taskId: t.id, title: t.title });
      next.set(t.id, after);
    }
  }
  const handoffSkipMessage = skipped.length ? `${skipped.length} homeowner or Active Owner Tasks were left as non-blocking.` : null;
  if (!changed.length) return { ok: false, error: handoffSkipMessage ?? "The selected Tasks already have these settings." };

  const before = homeBlockingCount(tasks) === 0;
  const after = homeBlockingCount([...next.values()]) === 0;
  const message =
    before === after
      ? null
      : before
        ? "This home would go from Ready to Not ready for handoff."
        : "This home would go from Not ready to Ready for handoff.";
  return { ok: true, changed, skipped, summary: patchParts(patch, roleName, dateLabel), handoffSkipMessage, readiness: { before, after, message } };
}

export function homeBulkPreviewSentence(plan: Extract<HomeBulkPlan, { ok: true }>, homeName: string) {
  const n = plan.changed.length;
  return `This will change ${n} Task${n === 1 ? "" : "s"} on ${homeName}: ${plan.summary.join("; ")}.`;
}
