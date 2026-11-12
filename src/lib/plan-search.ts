/**
 * Plan search on a home's Plan tab (Nov 12 item 30). Typing filters Tasks by
 * title across every stage, finished ones included, and each result names its
 * stage; a blank search returns null so the normal list shows. Pure.
 */
import { SIX_STAGES, sixStageFor } from "@/lib/onboarding-board";

export const OTHER_STAGE_LABEL = "Other tasks";

const norm = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, " ").trim();

export type PlanSearchHit<T> = { task: T; stage: string };

export function searchPlanTasks<T extends { title: string; stage: string }>(
  tasks: readonly T[],
  term: string,
): PlanSearchHit<T>[] | null {
  const q = norm(term);
  if (!q) return null;
  const order = (stage: string) => {
    const i = (SIX_STAGES as readonly string[]).indexOf(stage);
    return i === -1 ? SIX_STAGES.length : i;
  };
  return tasks
    .filter((t) => norm(t.title).includes(q))
    .map((task) => ({ task, stage: sixStageFor(task.stage) ?? OTHER_STAGE_LABEL }))
    .sort((a, b) => order(a.stage) - order(b.stage) || a.task.title.localeCompare(b.task.title));
}

/** The element id of a stage block on the Plan tab, used by the stage cards to scroll there. */
export function planStageElementId(index: number): string {
  return `plan-stage-${index}`;
}
