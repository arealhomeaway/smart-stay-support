import { buildReleaseContext, releaseState, type StateProperty, type StateProject } from "./onboarding-state";
import { projectScope, splitByScope } from "./onboarding-scope";
import type { WorkflowTask } from "./onboarding-workflow";
import type { StageCapture } from "./onboarding-stage";

export const BREEZEWAY_COMPLETION_NOTE = "Completed in Breezeway";
export function breezewayCompleted(stage: string | null | undefined, status: string | null | undefined) {
  return [stage, status].some(value => ["finished", "approved", "closed", "completed", "complete"].includes((value ?? "").trim().toLowerCase()));
}
export function breezewayCompletionAllowed(property: StateProperty, project: StateProject, tasks: WorkflowTask[], taskId: string, captures: StageCapture[]) {
  const task = tasks.find(row => row.id === taskId);
  if (!task || task.status === "complete" || task.status === "carryover" || task.completed_at || !project || project.completed_at || project.status === "cancelled") return false;
  const latest = captures.filter(c => c.stage === task.stage).sort((a, b) => b.revision - a.revision)[0];
  if (latest && ["complete", "awaiting_review"].includes(latest.status)) return false;
  const scoped = splitByScope(tasks, projectScope(project));
  if (!scoped.inScope.some(t => t.id === taskId)) return false;
  const context = buildReleaseContext({ property, project, tasks: scoped.inScope, handoff: null, stageCaptures: captures });
  return releaseState(task, scoped.inScope, context).canComplete;
}