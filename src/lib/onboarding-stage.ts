import { ONBOARDING_STAGES } from "./onboarding";
import { projectScope, splitByScope } from "./onboarding-scope";
import type { WorkflowTask } from "./onboarding-workflow";

export type StageStatus = "draft" | "awaiting_review" | "correction_required" | "complete";
export type StageAction = "save" | "submit" | "approve" | "return" | "reopen";
export type StageCapture = {
  stage: string;
  revision: number;
  status: StageStatus;
  observation: string;
  evidenceIds: string[];
  reason: string;
  actor: string;
  recordedAt: string;
  taskSnapshot?: WorkflowTask[];
  scopeSnapshot?: { modules: string[]; furnishing_scope: string; director: string | null };
};

export function stageCompletionBlockers(
  stage: string,
  tasks: WorkflowTask[],
  scope: Parameters<typeof projectScope>[0],
): string[] {
  const applicable = splitByScope(tasks, projectScope(scope)).inScope.filter(
    (t) => t.stage === stage,
  );
  return applicable.flatMap((t) => {
    if (t.status !== "complete" && t.status !== "carryover") return [`${t.title}: work is open`];
    if (t.requires_owner_approval && t.owner_approval_status !== "approved")
      return [`${t.title}: owner decision is missing`];
    if (t.evidence_required && !t.evidence_note?.trim()) return [`${t.title}: evidence is missing`];
    if (t.blocker?.trim()) return [`${t.title}: ${t.blocker}`];
    if (t.status === "carryover" && (!t.assigned_to || !t.due_on || !t.carryover_reason?.trim()))
      return [`${t.title}: carryover needs an owner, date and reason`];
    return [];
  });
}

export function nextStageCapture(input: {
  current: StageCapture | null;
  stage: string;
  expectedRevision: number;
  action: StageAction;
  observation: string;
  evidenceIds: string[];
  reason: string;
  actor: string;
  canReview: boolean;
  blockers: string[];
  now: string;
}): StageCapture {
  if (!ONBOARDING_STAGES.some((s) => s.value === input.stage))
    throw new Error("Unknown onboarding stage.");
  const revision = input.current?.revision ?? 0;
  if (revision !== input.expectedRevision)
    throw new Error("This stage changed. Refresh before saving.");
  const status = input.current?.status ?? "draft";
  const reviewAction = ["approve", "return", "reopen"].includes(input.action);
  if (reviewAction && !input.canReview)
    throw new Error("The Director of Onboarding must review this stage.");
  if (input.action === "reopen" && status !== "complete")
    throw new Error("Only a completed stage can be reopened.");
  if (["approve", "return"].includes(input.action) && status !== "awaiting_review")
    throw new Error("Submit this stage for review first.");
  if (["save", "submit"].includes(input.action) && ["complete", "awaiting_review"].includes(status))
    throw new Error("This capture is locked. Return or reopen it before editing.");
  if (["reopen", "return"].includes(input.action) && input.reason.trim().length < 3)
    throw new Error("Record a reason for the correction.");
  if (["submit", "approve"].includes(input.action) && input.blockers.length)
    throw new Error(`Stage is not ready: ${input.blockers.join("; ")}`);
  if (input.action === "submit" && input.observation.trim().length < 3)
    throw new Error("Record the stage findings before submitting.");
  return {
    stage: input.stage,
    revision: revision + 1,
    status:
      input.action === "approve"
        ? "complete"
        : input.action === "submit"
          ? "awaiting_review"
          : ["return", "reopen"].includes(input.action)
            ? "correction_required"
            : "draft",
    observation: reviewAction ? input.current!.observation : input.observation.trim(),
    evidenceIds: reviewAction ? input.current!.evidenceIds : [...new Set(input.evidenceIds)],
    reason: input.reason.trim(),
    actor: input.actor,
    recordedAt: input.now,
  };
}

function comparableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(comparableJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + comparableJson(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}

/** A completed label cannot stand in for the task/scope revision actually reviewed. */
export function stageReviewMatchesWork(
  capture: StageCapture | undefined,
  tasks: WorkflowTask[],
  project: {
    modules?: string[] | null;
    furnishing_scope?: string | null;
    director?: string | null;
  } | null,
) {
  if (
    !capture ||
    capture.status !== "complete" ||
    !Array.isArray(capture.taskSnapshot) ||
    !capture.scopeSnapshot
  )
    return false;
  const scope = {
    modules: project?.modules ?? [],
    furnishing_scope: project?.furnishing_scope ?? "full_furnishing",
    director: project?.director ?? null,
  };
  if (comparableJson(scope) !== comparableJson(capture.scopeSnapshot)) return false;
  const applicable = (rows: WorkflowTask[]) =>
    rows.filter((t) => t.stage === capture.stage).sort((a, b) => a.id.localeCompare(b.id));
  return comparableJson(applicable(tasks)) === comparableJson(applicable(capture.taskSnapshot));
}
