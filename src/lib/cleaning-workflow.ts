import { canTransitionCleaningTask, type CleaningTaskState } from "./cleaning-turnover.ts";
import {
  validateChecklistSubmission,
  type ChecklistAnswer,
  type ChecklistField,
} from "./ownerrez-checkout.ts";

export type TaskActor = {
  id: string;
  role: "cleaner" | "inspector" | "pc" | "operations_supervisor" | "director_operations";
};
export type TaskEvent = {
  at: string;
  actorId: string;
  action: string;
  from: CleaningTaskState;
  to: CleaningTaskState;
  note: string;
};
export type TaskSubmission = {
  round: number;
  at: string;
  actorId: string;
  answers: readonly ChecklistAnswer[];
};
export type SyntheticCleaningTask = {
  id: string;
  kind: "departure" | "inspection";
  state: CleaningTaskState;
  assignedUserId: string | null;
  departureCleaningState?: CleaningTaskState | null;
  checklistVersion: string;
  checklistApproved: boolean;
  fields: readonly ChecklistField[];
  answers: readonly ChecklistAnswer[];
  correctionRound: number;
  events: readonly TaskEvent[];
  submissions: readonly TaskSubmission[];
};
export type TaskAction =
  | "accept"
  | "begin"
  | "submit"
  | "begin_review"
  | "approve"
  | "require_correction"
  | "reopen"
  | "decline"
  | "expire";

export function offerSyntheticTask(
  task: SyntheticCleaningTask,
  cleanerId: string,
  actor: TaskActor,
  at: string,
): SyntheticCleaningTask {
  if (task.state !== "scheduled" || task.assignedUserId || !cleanerId)
    throw new Error("Only an unassigned scheduled task can be offered.");
  if (
    actor.role !== "pc" &&
    actor.role !== "operations_supervisor" &&
    actor.role !== "director_operations"
  )
    throw new Error("Operations dispatch role required.");
  return {
    ...task,
    state: "offered",
    assignedUserId: cleanerId,
    events: [
      ...task.events,
      {
        at,
        actorId: actor.id,
        action: "manual_offer",
        from: "scheduled",
        to: "offered",
        note: "Manual verified cleaner choice",
      },
    ],
  };
}

export function writeSyntheticTask(
  task: SyntheticCleaningTask,
  action: TaskAction,
  actor: TaskActor,
  at: string,
  note: string,
  answers: readonly ChecklistAnswer[] = task.answers,
): SyntheticCleaningTask {
  if (!actor.id || !Number.isFinite(Date.parse(at)))
    throw new Error("Actor and valid timestamp are required.");
  const isWorker =
    actor.id === task.assignedUserId && (actor.role === "cleaner" || actor.role === "inspector");
  const isReviewer =
    (actor.role === "inspector" && task.kind === "departure") ||
    actor.role === "pc" ||
    actor.role === "operations_supervisor" ||
    actor.role === "director_operations";
  const destination: Record<TaskAction, CleaningTaskState> = {
    accept: "accepted",
    begin: "in_progress",
    submit: "submitted",
    begin_review: "pending_review",
    approve: "approved",
    require_correction: "correction_required",
    reopen: "reopened_in_progress",
    decline: "declined",
    expire: "expired",
  };
  const to = destination[action];
  if (!canTransitionCleaningTask(task.state, to))
    throw new Error("Invalid cleaning task transition.");
  if (["accept", "begin", "submit", "reopen", "decline"].includes(action) && !isWorker)
    throw new Error("Only the assigned worker may perform this action.");
  if (["begin_review", "approve", "require_correction"].includes(action) && !isReviewer)
    throw new Error("Operations reviewer role required.");
  if (
    action === "expire" &&
    actor.role !== "operations_supervisor" &&
    actor.role !== "director_operations"
  )
    throw new Error("Supervisor role required to expire an offer.");
  if (["submit", "approve"].includes(action) && !task.checklistApproved)
    throw new Error("Checklist version is not approved for execution.");
  if (
    action === "begin" &&
    task.kind === "inspection" &&
    !["submitted", "pending_review", "approved"].includes(task.departureCleaningState ?? "")
  ) {
    throw new Error("Departure cleaning must be submitted before inspection begins.");
  }
  if (action === "submit") {
    const errors = validateChecklistSubmission(task.fields, answers);
    if (errors.length) throw new Error(errors.join("; "));
  }
  if (action === "require_correction" && !note.trim())
    throw new Error("Correction reason is required.");
  const round = action === "reopen" ? task.correctionRound + 1 : task.correctionRound;
  return {
    ...task,
    state: to,
    answers: [...answers],
    correctionRound: round,
    submissions:
      action === "submit"
        ? [...task.submissions, { round, at, actorId: actor.id, answers: [...answers] }]
        : task.submissions,
    events: [...task.events, { at, actorId: actor.id, action, from: task.state, to, note }],
  };
}

export function expiredOfferIds(
  tasks: readonly SyntheticCleaningTask[],
  deadlines: ReadonlyMap<string, string>,
  now: string,
): string[] {
  const current = Date.parse(now);
  return tasks
    .filter(
      (task) =>
        (task.state === "offered" || task.state === "pending_acceptance") &&
        deadlines.has(task.id) &&
        Date.parse(deadlines.get(task.id)!) <= current,
    )
    .map((task) => task.id);
}

export function atRiskTaskIds(tasks: readonly SyntheticCleaningTask[]): string[] {
  return tasks
    .filter(
      (task) => !task.assignedUserId && !["approved", "closed_cancelled"].includes(task.state),
    )
    .map((task) => task.id);
}
