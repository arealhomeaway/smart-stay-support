/**
 * Browser-safe planning for the Workflow Template bulk editor.
 *
 * The database action re-checks every rule before writing; this planner only
 * gives the editor an accurate preview and keeps locked homeowner work visible.
 */
import { anchorLabel, describeRule, type OffsetUnit, type PlanAnchor } from "./plan-rules";
import { handoffLocked } from "./template-step-dialog";

export type TemplateBulkStep = {
  id: string;
  title: string;
  stage: string;
  sort_order: number;
  functional_role: string | null;
  is_required: boolean;
  blocks_handoff: boolean;
  offset_days: number | null;
  schedule_anchor: string | null;
  offset_unit: string;
  requires_owner_approval: boolean;
  tags: string[];
};

export type TemplateBulkPatch = {
  dueRule?: { offsetDays: number | null; scheduleAnchor: PlanAnchor | null };
  offsetUnit?: OffsetUnit;
  functionalRole?: string | null;
  isRequired?: boolean;
  blocksHandoff?: boolean;
  stage?: string;
};

export type TemplateBulkSkip = { stepId: string; title: string; reason: string };
export type TemplateBulkChange = {
  stepId: string;
  title: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

export type TemplateBulkPlan =
  | {
      ok: true;
      changes: TemplateBulkChange[];
      skipped: TemplateBulkSkip[];
      summary: string[];
      handoffSkipMessage: string | null;
    }
  | { ok: false; error: string };

const HANDOFF_SKIP_REASON = "Homeowner or Active Owner steps are left as non-blocking.";

function patchParts(patch: TemplateBulkPatch, roleName: (code: string | null) => string) {
  const parts: string[] = [];
  if (patch.dueRule) {
    if (patch.dueRule.offsetDays === null) {
      parts.push("due date rule to No date rule");
    } else if (patch.offsetUnit) {
      parts.push(`due date to ${describeRule(patch.dueRule.scheduleAnchor, patch.dueRule.offsetDays, patch.offsetUnit)}`);
    } else {
      const days = Math.abs(patch.dueRule.offsetDays);
      const direction = patch.dueRule.offsetDays < 0 ? "before" : "after";
      parts.push(
        patch.dueRule.offsetDays === 0
          ? `due date to ${anchorLabel(patch.dueRule.scheduleAnchor).toLowerCase()}`
          : `due date to ${days} day${days === 1 ? "" : "s"} ${direction} ${anchorLabel(patch.dueRule.scheduleAnchor).toLowerCase()} (each step keeps its day type)`,
      );
    }
  }
  if (patch.offsetUnit) parts.push(patch.offsetUnit === "business" ? "business days" : "calendar days");
  if (patch.functionalRole !== undefined) parts.push(`assigned role to ${roleName(patch.functionalRole)}`);
  if (patch.isRequired !== undefined) parts.push(patch.isRequired ? "Required" : "Optional");
  if (patch.blocksHandoff !== undefined) parts.push(`Blocks handoff: ${patch.blocksHandoff ? "Yes" : "No"}`);
  if (patch.stage) parts.push(`stage to ${patch.stage}`);
  return parts;
}

/** Build the exact preview. Nothing here writes; the RPC repeats these checks. */
export function planTemplateBulkEdit(
  steps: TemplateBulkStep[],
  selectedIds: string[],
  patch: TemplateBulkPatch,
  options: { stages: string[]; roleName?: (code: string | null) => string },
): TemplateBulkPlan {
  const roleName = options.roleName ?? ((code) => code ?? "Unassigned");
  if (!selectedIds.length) return { ok: false, error: "Select at least one step." };
  if (!Object.keys(patch).length) return { ok: false, error: "Choose at least one change." };
  if (patch.dueRule) {
    if (patch.dueRule.offsetDays !== null) {
      if (!Number.isInteger(patch.dueRule.offsetDays) || patch.dueRule.offsetDays < -260 || patch.dueRule.offsetDays > 365)
        return { ok: false, error: "Days must be a whole number from -260 to 365." };
      if (!patch.dueRule.scheduleAnchor) return { ok: false, error: "Choose what the due date starts from." };
    } else if (patch.dueRule.scheduleAnchor !== null) {
      return { ok: false, error: "Choose days, or clear the date rule." };
    }
  }
  if (patch.functionalRole === "owner") return { ok: false, error: "Owner is not an internal assigned role." };
  if (patch.stage !== undefined && (!patch.stage.trim() || !options.stages.includes(patch.stage)))
    return { ok: false, error: "Choose a stage in this template." };

  const byId = new Map(steps.map((step) => [step.id, step]));
  const missing = selectedIds.filter((id) => !byId.has(id));
  if (missing.length) return { ok: false, error: "Some selected steps are no longer in this template. Refresh and try again." };

  const skipped: TemplateBulkSkip[] = [];
  const changes: TemplateBulkChange[] = [];
  for (const id of selectedIds) {
    const step = byId.get(id)!;
    if (patch.blocksHandoff === true && handoffLocked(step)) {
      skipped.push({ stepId: step.id, title: step.title, reason: HANDOFF_SKIP_REASON });
      continue;
    }

    const after = {
      offset_days: patch.dueRule ? patch.dueRule.offsetDays : step.offset_days,
      schedule_anchor: patch.dueRule
        ? patch.dueRule.offsetDays === null
          ? null
          : patch.dueRule.scheduleAnchor
        : step.schedule_anchor,
      offset_unit: patch.offsetUnit ?? step.offset_unit,
      functional_role: patch.functionalRole !== undefined ? patch.functionalRole : step.functional_role,
      is_required: patch.isRequired ?? step.is_required,
      blocks_handoff: patch.blocksHandoff ?? step.blocks_handoff,
      stage: patch.stage ?? step.stage,
    };
    const before = {
      offset_days: step.offset_days,
      schedule_anchor: step.schedule_anchor,
      offset_unit: step.offset_unit,
      functional_role: step.functional_role,
      is_required: step.is_required,
      blocks_handoff: step.blocks_handoff,
      stage: step.stage,
    };
    const changed = (Object.keys(before) as (keyof typeof before)[]).some((key) => before[key] !== after[key]);
    if (changed) changes.push({ stepId: step.id, title: step.title, before, after });
  }

  const summary = patchParts(patch, roleName);
  const handoffSkipMessage = skipped.length
    ? `${skipped.length} homeowner or Active Owner steps were left as non-blocking.`
    : null;
  if (!changes.length) return { ok: false, error: handoffSkipMessage ?? "The selected steps already have these settings." };
  return { ok: true, changes, skipped, summary, handoffSkipMessage };
}

export function bulkPreviewSentence(plan: Extract<TemplateBulkPlan, { ok: true }>) {
  return `This will change ${plan.changes.length} steps: ${plan.summary.join("; ")}.`;
}

export function bulkAnchorLabel(anchor: string | null | undefined) {
  return anchorLabel(anchor);
}
