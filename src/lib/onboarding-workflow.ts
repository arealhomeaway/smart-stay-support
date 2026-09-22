/**
 * Onboarding workflow presentation model (browser-safe, read-only).
 *
 * Everything here is derived at read time from records that already exist:
 * `onboarding_tasks` rows plus the canonical Full Furnishing template. No new
 * schema, no persisted state, no routing or permission decisions.
 *
 * The point is a familiar sectioned plan with Resolve's automation made legible:
 * a task's status, its blocker reason, why it exists and why its due date is
 * what it is are all explained from real fields.
 */

import { ONBOARDING_STAGES, dependencyBlocked, isOverdue, stageLabel } from "./onboarding";
import { releaseState, type ReleaseContext, type ReleaseState } from "./onboarding-state";

import { FULL_FURNISHING_TEMPLATE, type TemplateTask } from "./onboarding-template";
import { SEAT_LABELS, type SeatCode } from "./onboarding-ownership";
import type { WorkState } from "./semantic";

export type WorkflowTask = {
  id: string;
  property_id: string;
  stage: string;
  title: string;
  detail: string | null;
  assigned_to: string | null;
  assigned_seat: string | null;
  due_on: string | null;
  due_on_source: string | null;
  due_on_overridden: boolean;
  schedule_anchor: string | null;
  schedule_offset_days: number | null;
  depends_on: string[] | null;
  parent_task_id: string | null;
  blocker: string | null;
  blocks_handoff: boolean;
  evidence_required: boolean;
  evidence_note: string | null;
  requires_owner_approval: boolean;
  owner_approval_status: string;
  exception_reason: string | null;
  carryover_of: string | null;
  carryover_reason: string | null;
  linked_ticket_id: string | null;
  status: string;
  sort_order: number;
  completed_at: string | null;
  /** Present on rows loaded from the database; used for accepted-plan locking. */
  created_at?: string | null;
  updated_at?: string | null;
};

/* ---------------------------------------------------------------- statuses */

export type DerivedStatus =
  | "future"
  | "not_ready"
  | "ready"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "correction"
  | "complete"
  | "carryover";

export const STATUS_LABEL: Record<DerivedStatus, string> = {
  future: "Future",
  not_ready: "Not Ready",
  ready: "Ready",
  in_progress: "In Progress",
  blocked: "Waiting",
  needs_review: "Awaiting Review",
  correction: "Correction Required",
  complete: "Complete",
  carryover: "Carryover",
};

export const STATUS_STATE: Record<DerivedStatus, WorkState> = {
  future: "new",
  not_ready: "new",
  ready: "active",
  in_progress: "active",
  blocked: "waiting",
  needs_review: "waiting",
  correction: "blocked",
  complete: "done",
  carryover: "info",
};

export type TaskView = {
  task: WorkflowTask;
  status: DerivedStatus;
  /** System-generated blocker reason, e.g. "Blocked — Waiting on Owner". */
  reason: string | null;
  overdue: boolean;
  waitingOn: string[];
  markers: Marker[];
  template: TemplateTask | null;
  /** True when the step is genuinely actionable today. */
  canComplete: boolean;
};

export type Marker = { key: string; label: string; explain: string };

const templateByTitle = new Map<string, TemplateTask>(
  FULL_FURNISHING_TEMPLATE.map((t) => [t.title.trim().toLowerCase(), t]),
);

export function templateFor(title: string): TemplateTask | null {
  return templateByTitle.get(title.trim().toLowerCase()) ?? null;
}

const ANCHOR_LABEL: Record<string, string> = {
  planned_closing: "Planned Closing",
  actual_closing: "Actual Closing",
  actual_access: "Actual Access",
};

export function anchorLabel(anchor: string | null | undefined) {
  return ANCHOR_LABEL[anchor ?? ""] ?? "milestone";
}

/** Maps the authoritative release state onto the presentation status. */
const RELEASE_TO_STATUS: Record<ReleaseState, DerivedStatus> = {
  future: "future",
  waiting: "blocked",
  ready: "ready",
  in_progress: "in_progress",
  awaiting_review: "needs_review",
  correction_required: "correction",
  complete: "complete",
  not_applicable: "carryover",
};

/** Everything the workflow table and drawer need for one task. */
export function viewTask(
  task: WorkflowTask,
  all: WorkflowTask[],
  release?: ReleaseContext,
): TaskView {
  const template = templateFor(task.title);
  // Sequencing is advisory only: prerequisites never hold a step back and are
  // not surfaced on the card.
  const waitingOn: string[] = [];


  const evidenceMissing = task.evidence_required && !(task.evidence_note ?? "").trim();
  const awaitingOwner =
    task.requires_owner_approval &&
    task.owner_approval_status !== "approved" &&
    task.owner_approval_status !== "not_required";

  let status: DerivedStatus;
  let reason: string | null = null;

  if (task.status === "carryover") {
    status = "carryover";
    reason = task.carryover_reason ?? "Moved to Operations as carryover work.";
  } else if (task.status === "complete") {
    status = "complete";
  } else if ((task.blocker ?? "").trim()) {
    status = "blocked";
    reason = `Blocked — ${task.blocker!.trim()}`;
  } else if (waitingIds.length > 0) {
    status = "not_ready";
    reason =
      waitingOn.length > 0
        ? `Waiting on ${waitingOn.join(", ")}`
        : "Blocked — Dependency Incomplete";
  } else if (awaitingOwner && task.owner_approval_status === "awaiting_owner") {
    status = "needs_review";
    reason = "Blocked — Waiting on Owner";
  } else if (awaitingOwner && task.owner_approval_status === "changes_requested") {
    status = "blocked";
    reason = "Blocked — Homeowner requested changes";
  } else if (task.status === "blocked") {
    status = "blocked";
    reason = evidenceMissing ? "Blocked — Missing Evidence" : "Blocked — Internal Review";
  } else if (awaitingOwner) {
    status = "needs_review";
    reason = "Homeowner approval required before completion";
  } else if ((task.evidence_note ?? "").trim() || task.exception_reason) {
    status = "in_progress";
  } else {
    status = "ready";
  }

  const markers: Marker[] = [];
  if (task.schedule_anchor) {
    markers.push({
      key: "auto-date",
      label: "Auto-date",
      explain: `Due date generated automatically from ${anchorLabel(task.schedule_anchor)}${
        task.schedule_offset_days != null ? ` + ${task.schedule_offset_days} business day(s)` : ""
      }.`,
    });
  }
  if ((task.depends_on ?? []).length > 0) {
    markers.push({
      key: "dependency",
      label: "Dependency",
      explain:
        waitingOn.length > 0
          ? `Released after ${waitingOn.join(", ")} completes.`
          : "Released — every prerequisite task is complete.",
    });
  }
  if (task.requires_owner_approval) {
    markers.push({
      key: "owner",
      label: "Owner",
      explain:
        "Sent to the Owner Portal for a recorded homeowner decision. Sending alone does not complete the step.",
    });
  }
  if (task.evidence_required) {
    markers.push({
      key: "evidence",
      label: "Evidence",
      explain: evidenceMissing
        ? "Required evidence is not recorded yet — this task cannot be marked complete."
        : "Required evidence is recorded.",
    });
  }
  if (template?.breezewayTemplateId) {
    markers.push({
      key: "bw",
      label: "BW",
      explain: "This step is fulfilled by a Breezeway New House Setup work order.",
    });
  }
  if (template) {
    markers.push({
      key: "auto",
      label: "Auto",
      explain: "Created automatically from the standard ARHA onboarding template.",
    });
  }

  // Release gating is authoritative when the caller supplies the project's
  // release context: a phase that has not been released can never read Ready,
  // and nothing outside the released work can be completed early.
  let canComplete = status !== "complete" && status !== "carryover";
  if (release) {
    const verdict = releaseState(task, all, release);
    status = RELEASE_TO_STATUS[verdict.state] ?? "ready";
    reason = verdict.reason ?? reason;
    canComplete = verdict.canComplete;
  } else if (status === "needs_review" || status === "blocked" || status === "not_ready") {
    canComplete = false;
  }

  // Overdue describes work someone can actually do today. A task that is
  // still waiting on a prerequisite, an internal blocker or a homeowner
  // decision is legitimately not startable, so its date is not the team's
  // failure and must not be reported as late.
  const WORKABLE = status === "ready" || status === "in_progress" || status === "correction";
  return {
    task,
    status,
    reason,
    overdue: WORKABLE && isOverdue(task),
    waitingOn,
    markers,
    template,
    canComplete,
  };
}

/* ---------------------------------------------------------------- sections */

export type SectionState = "complete" | "active" | "blocked" | "not_ready" | "empty";

export type WorkflowSection = {
  key: string;
  label: string;
  tasks: TaskView[];
  done: number;
  total: number;
  state: SectionState;
};

/**
 * Sections come from the task rows themselves, ordered by the canonical ARHA
 * phases. Any stage value that is not in the canonical list still gets its own
 * section at the end so nothing is ever hidden.
 */
export function buildSections(tasks: WorkflowTask[], release?: ReleaseContext): WorkflowSection[] {
  const views = tasks.map((t) => viewTask(t, tasks, release));
  const order = ONBOARDING_STAGES.map((s) => s.value as string);
  const stages = [
    ...order.filter((s) => views.some((v) => v.task.stage === s)),
    ...[...new Set(views.map((v) => v.task.stage))].filter((s) => !order.includes(s)),
  ];

  return stages.map((stage) => {
    const inStage = views
      .filter((v) => v.task.stage === stage)
      .sort((a, b) => a.task.sort_order - b.task.sort_order);
    const done = inStage.filter((v) => v.status === "complete" || v.status === "carryover").length;
    const total = inStage.length;

    let state: SectionState = "empty";
    if (total > 0) {
      if (done === total) state = "complete";
      else if (inStage.some((v) => v.status === "correction")) state = "blocked";
      else if (inStage.some((v) => v.status === "ready" || v.status === "in_progress"))
        state = "active";
      else if (inStage.some((v) => v.status === "blocked" || v.status === "needs_review"))
        state = "blocked";
      else state = "not_ready";
    }

    return { key: stage, label: stageLabel(stage), tasks: inStage, done, total, state };
  });
}

/** The section a team should be looking at: first one that is not finished. */
export function activeSectionKey(sections: WorkflowSection[]): string | null {
  return sections.find((s) => s.total > 0 && s.state !== "complete")?.key ?? null;
}

/* ------------------------------------------------------- why this exists */

/** Plain-language explanation of the workflow logic behind a task. */
export function whyThisTaskExists(view: TaskView, all: WorkflowTask[]): string[] {
  const lines: string[] = [];
  const { task, template } = view;

  if (template) {
    lines.push(
      `Standard step of the ARHA Full Furnishing onboarding workflow, owned by the ${template.role}.`,
    );
  } else {
    lines.push("Added to this home by the onboarding team outside the standard template.");
  }

  if (task.schedule_anchor) {
    lines.push(
      `Due date calculated from ${anchorLabel(task.schedule_anchor)}${
        task.schedule_offset_days != null ? ` + ${task.schedule_offset_days} business day(s)` : ""
      }.`,
    );
  }
  if (task.due_on_overridden) {
    lines.push("The due date was set manually and is protected from milestone recalculation.");
  }

  if (view.waitingOn.length > 0) {
    lines.push(`Released when ${view.waitingOn.join(" and ")} completes.`);
  } else if ((task.depends_on ?? []).length > 0) {
    lines.push("Release conditions are met — every prerequisite task is complete.");
  }

  const downstream = all.filter((t) => (t.depends_on ?? []).includes(task.id)).map((t) => t.title);
  if (downstream.length > 0) {
    lines.push(`Completing this releases ${downstream.join(", ")}.`);
  }

  if (template?.ownerApprovalWhenActiveOwner) {
    lines.push("Requires a recorded homeowner decision only for Active Owner Program homes.");
  } else if (task.requires_owner_approval) {
    lines.push("Requires a recorded homeowner decision before it can be completed.");
  }

  if (task.evidence_required) {
    lines.push(
      task.evidence_note
        ? "Evidence is required before completion, and has been recorded."
        : "Evidence is required before completion — none recorded yet.",
    );
  }

  if (template?.breezewayTemplateId) {
    lines.push("Fulfilled by a Breezeway New House Setup work order.");
  }

  if (task.blocks_handoff) {
    lines.push("Blocks handoff to Operations while it is open.");
  }
  if (task.exception_reason) {
    lines.push(`An authorised exception is recorded: ${task.exception_reason}`);
  }

  return lines;
}

/** How the due date came to be, in one short line for the table/drawer. */
export function dueExplanation(task: WorkflowTask): string | null {
  if (!task.due_on) return null;
  if (task.due_on_overridden) return "Set manually — protected from recalculation.";
  if (task.schedule_anchor) {
    return `Auto: ${anchorLabel(task.schedule_anchor)}${
      task.schedule_offset_days != null ? ` + ${task.schedule_offset_days} business days` : ""
    }`;
  }
  if (task.due_on_source) return `Source: ${task.due_on_source}`;
  return null;
}

/* -------------------------------------------------------------- assignee */

export function assigneeLabel(
  task: Pick<WorkflowTask, "assigned_to" | "assigned_seat">,
  people: { id: string; full_name: string | null; email: string | null }[],
): string {
  if (task.assigned_to) {
    const p = people.find((x) => x.id === task.assigned_to);
    return p?.full_name || p?.email || "Teammate";
  }
  if (task.assigned_seat) {
    return SEAT_LABELS[task.assigned_seat as SeatCode] ?? task.assigned_seat;
  }
  return "Unassigned";
}

/* ------------------------------------------------------- property rollups */

export type PropertyRollup = {
  total: number;
  done: number;
  progress: number;
  blocked: number;
  ownerPending: number;
  missingEvidence: number;
  overdue: number;
  carryover: number;
  nextMilestone: string | null;
  primaryBlocker: string | null;
};

export function rollupProperty(tasks: WorkflowTask[], release?: ReleaseContext): PropertyRollup {
  const views = tasks.map((t) => viewTask(t, tasks, release));
  const total = views.length;
  const done = views.filter((v) => v.status === "complete" || v.status === "carryover").length;
  const open = views.filter((v) => v.status !== "complete" && v.status !== "carryover");
  const blockedViews = open.filter((v) => v.status === "blocked" || v.status === "needs_review");
  const next = [...open]
    .filter((v) => v.status === "ready" || v.status === "in_progress")
    .sort((a, b) => (a.task.due_on ?? "9999").localeCompare(b.task.due_on ?? "9999"))[0];

  return {
    total,
    done,
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
    blocked: blockedViews.length,
    ownerPending: open.filter(
      (v) => v.task.requires_owner_approval && v.task.owner_approval_status !== "approved",
    ).length,
    missingEvidence: open.filter(
      (v) => v.task.evidence_required && !(v.task.evidence_note ?? "").trim(),
    ).length,
    overdue: open.filter((v) => v.overdue).length,
    carryover: views.filter((v) => v.status === "carryover").length,
    nextMilestone: next?.task.title ?? null,
    primaryBlocker: blockedViews[0]?.reason ?? null,
  };
}
