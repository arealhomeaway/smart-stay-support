/**
 * Progress across the eight operational stages.
 *
 * Pure: it counts what is finished, what is stuck and what is late in each
 * stage, so the same numbers can be shown on a project, tested without a
 * database, and never drift between screens.
 */
import { MASTER_STAGES, type MasterStage } from "./onboarding-master-sequence";
import { masterStageForLegacyTask } from "./onboarding-stage-map";

export type StageTask = {
  id: string;
  title: string;
  stage: string;
  status: string;
  blocker?: string | null;
  dueOn?: string | null;
  assignedTo?: string | null;
  parentTaskId?: string | null;
  archivedAt?: string | null;
  ownerApprovalStatus?: string | null;
  requiresOwnerApproval?: boolean | null;
};

export type StageProgress = {
  stage: MasterStage;
  label: string;
  steps: string;
  total: number;
  complete: number;
  carryover: number;
  blocked: number;
  overdue: number;
  awaitingOwner: number;
  /** 0–100, complete over total. */
  percent: number;
  state: "not_started" | "in_progress" | "blocked" | "complete";
  blockedTasks: StageTask[];
  overdueTasks: StageTask[];
};

const DONE = new Set(["complete", "carryover", "not_required"]);

/** The stage a saved task belongs to, whichever heading it was created under. */
export function stageOf(task: StageTask): MasterStage | null {
  if (MASTER_STAGES.some((s) => s.value === task.stage)) return task.stage as MasterStage;
  return masterStageForLegacyTask(task.stage, task.title);
}

export function isOverdue(task: StageTask, today: string) {
  return Boolean(task.dueOn) && !DONE.has(task.status) && (task.dueOn as string) < today;
}

export function stageProgress(tasks: StageTask[], today: string): StageProgress[] {
  const live = tasks.filter((t) => !t.parentTaskId && !t.archivedAt);
  return MASTER_STAGES.map((stage) => {
    const mine = live.filter((t) => stageOf(t) === stage.value);
    const complete = mine.filter((t) => t.status === "complete").length;
    const carryover = mine.filter((t) => t.status === "carryover").length;
    const blockedTasks = mine.filter(
      (t) => t.status === "blocked" || Boolean(t.blocker?.trim()),
    );
    const overdueTasks = mine.filter((t) => isOverdue(t, today));
    const awaitingOwner = mine.filter(
      (t) => t.requiresOwnerApproval && (t.ownerApprovalStatus ?? "pending") === "pending",
    ).length;
    const percent = mine.length ? Math.round((complete / mine.length) * 100) : 0;
    const state: StageProgress["state"] = !mine.length
      ? "not_started"
      : complete + carryover === mine.length
        ? "complete"
        : blockedTasks.length
          ? "blocked"
          : complete > 0
            ? "in_progress"
            : "not_started";
    return {
      stage: stage.value,
      label: stage.label,
      steps: `Steps ${stage.steps[0]}–${stage.steps[1]}`,
      total: mine.length,
      complete,
      carryover,
      blocked: blockedTasks.length,
      overdue: overdueTasks.length,
      awaitingOwner,
      percent,
      state,
      blockedTasks,
      overdueTasks,
    };
  });
}

/** One line summarising the whole plan. */
export function planSummary(progress: StageProgress[]) {
  const total = progress.reduce((n, s) => n + s.total, 0);
  const complete = progress.reduce((n, s) => n + s.complete, 0);
  const blocked = progress.reduce((n, s) => n + s.blocked, 0);
  const overdue = progress.reduce((n, s) => n + s.overdue, 0);
  const current = progress.find((s) => s.state === "in_progress" || s.state === "blocked") ?? null;
  return {
    total,
    complete,
    blocked,
    overdue,
    percent: total ? Math.round((complete / total) * 100) : 0,
    currentStage: current?.label ?? (total && complete === total ? "Finished" : "Not started"),
  };
}
