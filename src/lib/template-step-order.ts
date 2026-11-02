/**
 * Browser-safe ordering for the Plan settings step list. The save goes through
 * the existing arrangeTemplateStepsFn path (whole plan order, stage per step).
 */
export type OrderStep = { id: string; stage: string; sort_order: number };

/**
 * Stage groups in screen order: the template's own stages first, then any
 * stage name that only exists on steps, so no step is ever hidden.
 */
export function stepGroups<S extends OrderStep>(stageNames: string[], steps: S[]): [string, S[]][] {
  const map = new Map<string, S[]>(stageNames.map((n) => [n, []]));
  const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order);
  for (const s of sorted) {
    const list = map.get(s.stage);
    if (list) list.push(s);
    else map.set(s.stage, [s]);
  }
  return [...map.entries()];
}

/** Whole-plan order with one step lifted out and dropped before another step, or at the end of a stage. */
export function moveStep(
  groups: [string, OrderStep[]][],
  stepId: string,
  targetStage: string,
  beforeStepId: string | null,
): { stepId: string; stage: string }[] {
  const order = groups.flatMap(([stage, list]) => list.map((s) => ({ stepId: s.id, stage }))).filter((e) => e.stepId !== stepId);
  const moved = { stepId, stage: targetStage };
  if (beforeStepId && beforeStepId !== stepId) {
    const at = order.findIndex((e) => e.stepId === beforeStepId);
    order.splice(at < 0 ? order.length : at, 0, moved);
    return order;
  }
  const stageNames = groups.map(([n]) => n);
  const targetIdx = stageNames.indexOf(targetStage);
  let at = order.length;
  for (let i = order.length - 1; i >= 0; i -= 1) {
    if (order[i]!.stage === targetStage) { at = i + 1; break; }
    if (i === 0) at = -1;
  }
  if (at === -1 || (at === order.length && !order.some((e) => e.stage === targetStage))) {
    // Empty stage: insert before the first step of any later stage.
    const later = order.findIndex((e) => stageNames.indexOf(e.stage) > targetIdx);
    at = later < 0 ? order.length : later;
  }
  order.splice(at, 0, moved);
  return order;
}
