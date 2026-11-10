/**
 * One way to read a person's onboarding Tasks as views: each Task with its own
 * home's scope and release context, test homes left out. My Tasks and
 * Onboarding Home's Today, for me both use it, so a Task ticks the same way in both.
 */
import { restoreAssignedRelease, type AssignedWorkContext } from "@/lib/onboarding-assigned-context";
import { projectScope, splitByScope } from "@/lib/onboarding-scope";
import { buildReleaseContext } from "@/lib/onboarding-state";
import { viewTask, type WorkflowTask } from "@/lib/onboarding-workflow";
import { isTestRecord } from "@/lib/test-data";

type Workspace = {
  assignedWorkContexts: AssignedWorkContext[];
  properties: { id: string }[];
  projects: { property_id: string; status: string }[];
  handoffs: { property_id: string | null; status: string }[];
  stageCaptures: { propertyId: string | null }[];
};

export function taskViewsFor(data: Workspace, allTasks: WorkflowTask[], tasks: WorkflowTask[]) {
  return tasks.flatMap((t) => {
    const assignedContext = data.assignedWorkContexts.find(
      (context) => context.propertyId === t.property_id,
    );
    if (assignedContext) {
      const property = data.properties.find((item) => item.id === t.property_id);
      return property && !isTestRecord(property as never)
        ? [viewTask(t, assignedContext.tasks as never, restoreAssignedRelease(assignedContext))]
        : [];
    }
    const property = data.properties.find((p) => p.id === t.property_id);
    if (!property || isTestRecord(property as never)) return [];
    const project =
      data.projects.find((p) => p.property_id === t.property_id && p.status !== "cancelled") ??
      null;
    const scoped = splitByScope(
      allTasks.filter((x) => x.property_id === t.property_id),
      projectScope(project as never),
    );
    if (!scoped.inScope.some((x) => x.id === t.id)) return [];
    const handoff =
      data.handoffs.find(
        (h) =>
          h.property_id === t.property_id &&
          ["requested", "accepted_pending_live"].includes(h.status),
      ) ?? null;
    const release = buildReleaseContext({
      property: property as never,
      project: project as never,
      tasks: scoped.inScope,
      handoff: handoff as never,
      stageCaptures: data.stageCaptures.filter((c) => c.propertyId === t.property_id) as never,
      excludedTaskIds: scoped.outOfScope.map((x) => x.task.id),
    });
    return [viewTask(t, scoped.inScope, release)];
  });
}
