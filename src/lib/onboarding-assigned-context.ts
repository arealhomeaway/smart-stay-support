import { buildReleaseContext, type StateInput, type ReleaseContext } from "./onboarding-state";
import { projectScope, splitByScope } from "./onboarding-scope";
import type { WorkflowTask } from "./onboarding-workflow";

export function assignedWorkContext(
  input: StateInput & {
    property: StateInput["property"] & { id: string };
    project:
      | (NonNullable<StateInput["project"]> & {
          furnishing_scope?: string | null;
          modules?: string[] | null;
        })
      | null;
  },
  userId: string,
) {
  const scoped = splitByScope(input.tasks, projectScope(input.project));
  const release = buildReleaseContext({
    ...input,
    tasks: scoped.inScope,
    excludedTaskIds: scoped.outOfScope.map(({ task }) => task.id),
  });
  const related = new Set(
    scoped.inScope.filter((task) => task.assigned_to === userId).map((task) => task.id),
  );
  const descendants = new Set(related);
  let expanded = true;
  while (expanded) {
    const size = related.size + descendants.size;
    for (const task of scoped.inScope) {
      if (related.has(task.id)) {
        for (const dependency of task.depends_on ?? []) related.add(dependency);
        if (task.parent_task_id) related.add(task.parent_task_id);
      }
      if (task.parent_task_id && descendants.has(task.parent_task_id)) {
        related.add(task.id);
        descendants.add(task.id);
      }
    }
    expanded = related.size + descendants.size !== size;
  }
  return {
    propertyId: input.property.id,
    tasks: scoped.inScope
      .filter((task) => related.has(task.id))
      .map((task): WorkflowTask => ({
        id: task.id,
        property_id: task.property_id,
        title: task.title,
        stage: task.stage,
        status: task.status,
        depends_on: task.depends_on,
        parent_task_id: task.parent_task_id,
        created_at: task.created_at ?? null,
        sort_order: task.sort_order,
        detail: null,
        assigned_to: null,
        assigned_seat: null,
        due_on: null,
        due_on_source: null,
        due_on_overridden: false,
        schedule_anchor: null,
        schedule_offset_days: null,
        blocker: null,
        blocks_handoff: false,
        evidence_required: false,
        evidence_note: null,
        requires_owner_approval: false,
        owner_approval_status: "not_required",
        exception_reason: null,
        carryover_of: null,
        carryover_reason: null,
        linked_ticket_id: null,
        completed_at: null,
      })),
    release: { ...release, released: [...release.released], reasons: [...release.reasons] },
  };
}
export type AssignedWorkContext = ReturnType<typeof assignedWorkContext>;
export function restoreAssignedRelease(context: AssignedWorkContext): ReleaseContext {
  return {
    ...context.release,
    released: new Set(context.release.released),
    reasons: new Map(context.release.reasons),
  };
}
