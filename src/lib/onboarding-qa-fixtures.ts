/** Canonical local acceptance fixtures. No database or external messages are used. */
import { FULL_FURNISHING_TEMPLATE } from "./onboarding-template";
import { seatForTask } from "./onboarding-ownership";
import { ONBOARDING_STAGES } from "./onboarding";
import { splitByScope, type FurnishingScope, type ProjectScope } from "./onboarding-scope";
import type { StateInput } from "./onboarding-state";
import type { WorkflowTask } from "./onboarding-workflow";

export const QA_SCENARIOS = ["pre_close", "work", "review", "pending_live", "live"] as const;
export type QaScenario = (typeof QA_SCENARIOS)[number];

export function createOnboardingQaProject(
  furnishing: FurnishingScope,
  scenario: QaScenario = "work",
) {
  const prefix = furnishing === "full_furnishing" ? "qa-full" : "qa-existing";
  const scope: ProjectScope = {
    furnishing,
    modules:
      furnishing === "full_furnishing"
        ? [
            "utilities",
            "repairs",
            "new_appliances",
            "smart_lock",
            "active_owner",
            "pool",
            "hoa",
            "cameras",
            "furniture_warranty",
          ]
        : ["utilities", "repairs", "existing_appliances", "smart_lock"],
  };
  const project = {
    id: `${prefix}-project`,
    status: scenario === "live" ? "complete" : "active",
    is_demo: true,
    furnishing_scope: furnishing,
    modules: scope.modules,
  };
  const property = {
    id: `${prefix}-property`,
    name: `QA — ${furnishing === "full_furnishing" ? "Full Furnishing" : "No Furnishings"}`,
    is_demo: true,
    onboarding_owner: "qa-project-manager",
    onboarding_stage: "post_contract",
    lifecycle_status:
      scenario === "live"
        ? "active_operations"
        : ["review", "pending_live"].includes(scenario)
          ? "handoff_requested"
          : "onboarding",
    planned_closing_on: "2026-09-01",
    actual_closing_on: scenario === "pre_close" ? null : "2026-09-01",
    actual_access_on: scenario === "pre_close" ? null : "2026-09-02",
    access_notes: scenario === "pre_close" ? null : "QA access confirmed; no real entry code",
    handoff_accepted_at: ["pending_live", "live"].includes(scenario)
      ? "2026-09-14T12:00:00Z"
      : null,
  };
  const completed = ["review", "pending_live", "live"].includes(scenario);
  const allTasks: (WorkflowTask & { is_demo: true })[] = [];
  for (const [index, source] of FULL_FURNISHING_TEMPLATE.entries()) {
    const id = `${prefix}-task-${index}`;
    const ownerApproval = Boolean(
      source.requiresOwnerApproval ||
      (source.ownerApprovalWhenActiveOwner && scope.modules.includes("active_owner")),
    );
    const task: WorkflowTask & { is_demo: true } = {
      id,
      property_id: property.id,
      stage: source.stage,
      title: source.title,
      detail: source.detail ?? null,
      assigned_to: "qa-project-manager",
      assigned_seat: seatForTask({ role: source.role, stage: source.stage }),
      due_on: null,
      due_on_source: null,
      due_on_overridden: false,
      schedule_anchor: source.anchor ?? null,
      schedule_offset_days: source.offsetDays ?? null,
      depends_on: [],
      parent_task_id: null,
      blocker: null,
      blocks_handoff: source.blocksHandoff,
      evidence_required: Boolean(source.evidenceRequired),
      evidence_note: completed ? "QA evidence checked — local fixture only" : null,
      requires_owner_approval: ownerApproval,
      owner_approval_status: ownerApproval ? (completed ? "approved" : "pending") : "not_required",
      exception_reason: null,
      carryover_of: null,
      carryover_reason: null,
      linked_ticket_id: null,
      status: completed ? "complete" : "open",
      sort_order: source.sortOrder,
      completed_at: completed ? "2026-09-14T11:00:00Z" : null,
      is_demo: true,
    };
    allTasks.push(task);
    for (const [childIndex, title] of (source.subtasks ?? []).entries()) {
      allTasks.push({
        ...task,
        id: `${id}-child-${childIndex}`,
        title,
        detail: null,
        parent_task_id: id,
        requires_owner_approval: false,
        owner_approval_status: "not_required",
        evidence_required: false,
        sort_order: childIndex + 1,
      });
    }
  }
  const { inScope, outOfScope } = splitByScope(allTasks, scope);
  const handoff = completed
    ? {
        id: `${prefix}-handoff`,
        property_id: property.id,
        status:
          scenario === "live"
            ? "accepted"
            : scenario === "pending_live"
              ? "accepted_pending_live"
              : "requested",
        gate_step:
          scenario === "live"
            ? "complete"
            : scenario === "pending_live"
              ? "live_confirmation"
              : "kati_review",
        live_confirmed_at: scenario === "live" ? "2026-09-14T13:00:00Z" : null,
      }
    : null;
  const state: StateInput = {
    property,
    project,
    tasks: inScope,
    handoff,
    stageCaptures: completed
      ? ONBOARDING_STAGES.map((stage) => ({ stage: stage.value, revision: 3, status: "complete" }))
      : [],
    excludedTaskIds: outOfScope.map(({ task }) => task.id),
  };
  return { property, project, scope, allTasks, inScope, outOfScope, state };
}
