/**
 * The one guided action on an onboarding task.
 *
 * Same pattern as the ticket workspace: what to do now, why it is next, what
 * has to be written down, and what happens the moment it is finished. Pure —
 * it reads only what viewTask() already derived and the task's own fields, and
 * it grants no authority: release rules, evidence gates and owner approval
 * remain the source of truth.
 */
import type { GuidedAction } from "@/lib/guided-action";
import type { TaskView, WorkflowTask } from "@/lib/onboarding-workflow";
import type { ReleaseContext } from "@/lib/onboarding-state";
import { viewTask } from "@/lib/onboarding-workflow";

export type TaskActionId =
  | "wait_for_dependency"
  | "clear_blocker"
  | "capture_evidence"
  | "send_for_approval"
  | "record_owner_answer"
  | "resubmit_for_approval"
  | "complete_task"
  | "reopen_or_move_on";

export type TaskAction = GuidedAction<TaskActionId, "dependency" | "approval" | "evidence">;

export function onboardingTaskAction(view: TaskView): TaskAction | null {
  const task = view.task;
  if (view.status === "carryover") return null;

  if (view.status === "complete") {
    return {
      id: "reopen_or_move_on",
      title: "This step is done",
      because: "Nothing else is needed here.",
      then: "Move on to the next step in this home's plan.",
      completeLabel: "Next step",
      fields: [],
    };
  }

  if (view.waitingOn.length > 0) {
    return {
      id: "wait_for_dependency",
      title: "Not released yet",
      because: `This step waits for ${view.waitingOn.join(", ")}.`,
      then: "It opens by itself the moment that finishes.",
      completeLabel: "See what it's waiting on",
      fields: [],
      handoff: { label: "See what it's waiting on", target: "dependency" },
    };
  }

  if ((task.blocker ?? "").trim()) {
    return {
      id: "clear_blocker",
      title: "Clear the blocker",
      because: `Someone flagged this: ${task.blocker!.trim()}`,
      then: "Once it's clear, the step goes back to being workable.",
      completeLabel: "Record & advance",
      fields: [
        {
          name: "update",
          label: "What changed",
          type: "longtext",
          required: true,
          minLength: 5,
        },
        {
          name: "outcome",
          label: "Where does it stand?",
          type: "choice",
          required: true,
          options: [
            { value: "cleared", label: "It's sorted — carry on with the step" },
            { value: "still_blocked", label: "Still blocked — keep it flagged" },
          ],
        },
      ],
    };
  }

  if (task.requires_owner_approval && task.owner_approval_status === "awaiting_owner") {
    return {
      id: "record_owner_answer",
      title: "Record the homeowner's answer",
      because: "The request is with the homeowner and no answer is on file yet.",
      then: "An approval lets the step be completed; changes requested sends it back to you.",
      completeLabel: "Record & advance",
      fields: [
        {
          name: "decision",
          label: "What did they say?",
          type: "choice",
          required: true,
          options: [
            { value: "approved", label: "They approved it" },
            { value: "changes", label: "They asked for changes" },
          ],
        },
        {
          name: "note",
          label: "What they said, and where the answer came from",
          type: "longtext",
          required: true,
          minLength: 5,
        },
        {
          name: "evidence_url",
          label: "Link to the reply email or saved document (optional)",
          type: "text",
          required: false,
        },
      ],
    };
  }

  if (task.requires_owner_approval && task.owner_approval_status === "changes_requested") {
    return {
      id: "resubmit_for_approval",
      title: "Send the revised version back",
      because: "The homeowner asked for changes, so the step is waiting on a new version.",
      then: "Then record their answer when it comes in.",
      completeLabel: "Resubmit & advance",
      fields: [
        {
          name: "version",
          label: "Version being reviewed",
          type: "text",
          required: true,
          minLength: 2,
          help: "For example: Mood boards v2.",
        },
        {
          name: "note",
          label: "What changed since last time",
          type: "longtext",
          required: true,
          minLength: 5,
        },
      ],
    };
  }

  if (
    task.requires_owner_approval &&
    task.owner_approval_status !== "approved" &&
    task.owner_approval_status !== "not_required"
  ) {
    return {
      id: "send_for_approval",
      title: "Send it to the homeowner",
      because: "This step needs a recorded homeowner decision before it can be completed.",
      then: "Then record their answer — sending alone doesn't finish the step.",
      completeLabel: "Send & advance",
      fields: [
        {
          name: "version",
          label: "Version being reviewed",
          type: "text",
          required: true,
          minLength: 2,
        },
        {
          name: "note",
          label: "What the homeowner is being asked to approve",
          type: "longtext",
          required: true,
          minLength: 5,
        },
      ],
    };
  }

  if (task.evidence_required && !(task.evidence_note ?? "").trim()) {
    return {
      id: "capture_evidence",
      title: "Record what proves this is done",
      because: "This step can't be completed until the required evidence is on file.",
      then: "Then you can mark it complete.",
      completeLabel: "Save & advance",
      fields: [
        {
          name: "evidence",
          label: "What proves this is done",
          type: "longtext",
          required: true,
          minLength: 3,
          help: "Photo location, document name, meter reading, confirmation number.",
        },
      ],
    };
  }

  if (!view.canComplete) {
    return {
      id: "wait_for_dependency",
      title: "Not workable yet",
      because: view.reason ?? "Something upstream is still holding this step.",
      completeLabel: "See why",
      fields: [],
      handoff: { label: "See why", target: "dependency" },
    };
  }

  return {
    id: "complete_task",
    title: "Finish this step",
    because: "Nothing is holding it — everything this step needs is on file.",
    then: "Then Resolve opens the next step in this home's plan.",
    completeLabel: "Complete & advance",
    fields: [
      {
        name: "observation",
        label: "Anything the next person should know (optional)",
        type: "longtext",
        required: false,
      },
    ],
  };
}

/** Actions the card can finish itself, rather than pointing somewhere else. */
export const COMPLETABLE_TASK_ACTIONS: TaskActionId[] = [
  "clear_blocker",
  "capture_evidence",
  "send_for_approval",
  "record_owner_answer",
  "resubmit_for_approval",
  "complete_task",
];

export function isCompletableTaskAction(id: TaskActionId) {
  return COMPLETABLE_TASK_ACTIONS.includes(id);
}

/**
 * The step to open once this one is finished — the next genuinely workable
 * task in the same home, in plan order, so nobody has to go back to the list
 * and work out what is next.
 */
export function nextActionableTask(
  current: WorkflowTask,
  all: WorkflowTask[],
  release?: ReleaseContext,
): WorkflowTask | null {
  const candidates = all
    .filter(
      (t) =>
        t.id !== current.id &&
        t.property_id === current.property_id &&
        t.status !== "complete" &&
        t.status !== "carryover",
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

  const workable = candidates.find((t) => viewTask(t, all, release).canComplete);
  return workable ?? candidates[0] ?? null;
}
