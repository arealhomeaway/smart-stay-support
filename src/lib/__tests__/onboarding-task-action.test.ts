import { describe, expect, it } from "bun:test";
import {
  isCompletableTaskAction,
  nextActionableTask,
  onboardingTaskAction,
} from "@/lib/onboarding-task-action";
import { validateAction } from "@/lib/guided-action";
import { viewTask, type WorkflowTask } from "@/lib/onboarding-workflow";

function task(patch: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: patch.id ?? "11111111-1111-4111-8111-111111111111",
    property_id: "22222222-2222-4222-8222-222222222222",
    stage: "phase1",
    title: patch.title ?? "Confirm access",
    detail: null,
    assigned_to: null,
    due_on: null,
    sort_order: 1,
    blocker: null,
    requires_owner_approval: false,
    owner_approval_status: "not_required",
    evidence_required: false,
    evidence_note: null,
    status: "open",
    blocks_handoff: false,
    parent_task_id: null,
    depends_on: [],
    linked_ticket_id: null,
    ...(patch as object),
  } as unknown as WorkflowTask;
}

const v = (t: WorkflowTask, all: WorkflowTask[] = [t]) => viewTask(t, all);

describe("the one guided action on an onboarding task", () => {
  it("offers to finish a step that nothing is holding", () => {
    const a = onboardingTaskAction(v(task()));
    expect(a?.id).toBe("complete_task");
    expect(validateAction(a!, {})).toBeNull();
  });

  it("asks for the required evidence before the step can be finished", () => {
    const a = onboardingTaskAction(v(task({ evidence_required: true })));
    expect(a?.id).toBe("capture_evidence");
    expect(validateAction(a!, {})).toContain("proves this is done");
    expect(validateAction(a!, { evidence: "Meter photo in the task files" })).toBeNull();
  });

  it("asks what changed before a blocker is cleared", () => {
    const a = onboardingTaskAction(v(task({ blocker: "Locksmith cancelled" })));
    expect(a?.id).toBe("clear_blocker");
    expect(validateAction(a!, { update: "Rebooked for Thursday" })).toContain("Where does it stand");
    expect(
      validateAction(a!, { update: "Rebooked for Thursday", outcome: "cleared" }),
    ).toBeNull();
  });

  it("walks the homeowner approval through send, answer and resubmit", () => {
    expect(
      onboardingTaskAction(
        v(task({ requires_owner_approval: true, owner_approval_status: "pending" })),
      )?.id,
    ).toBe("send_for_approval");
    expect(
      onboardingTaskAction(
        v(task({ requires_owner_approval: true, owner_approval_status: "awaiting_owner" })),
      )?.id,
    ).toBe("record_owner_answer");
    expect(
      onboardingTaskAction(
        v(task({ requires_owner_approval: true, owner_approval_status: "changes_requested" })),
      )?.id,
    ).toBe("resubmit_for_approval");
  });

  it("points at the dependency instead of offering a form when the step is not released", () => {
    const first = task({ id: "aaaaaaa1-1111-4111-8111-111111111111", title: "Closing confirmed" });
    const second = task({
      id: "aaaaaaa2-2222-4222-8222-222222222222",
      title: "Order linens",
      depends_on: [first.id],
      sort_order: 2,
    });
    const a = onboardingTaskAction(viewTask(second, [first, second]));
    expect(a?.id).toBe("wait_for_dependency");
    expect(a?.handoff?.target).toBe("dependency");
    expect(a?.because).toContain("Closing confirmed");
  });

  it("a finished step points at the next one, and a carryover has no action", () => {
    expect(onboardingTaskAction(v(task({ status: "complete" })))?.id).toBe("reopen_or_move_on");
    expect(onboardingTaskAction(v(task({ status: "carryover" })))).toBeNull();
  });

  it("advances to the next workable step in plan order", () => {
    const a = task({ id: "bbbbbbb1-1111-4111-8111-111111111111", sort_order: 1 });
    const blocked = task({
      id: "bbbbbbb2-2222-4222-8222-222222222222",
      title: "Blocked step",
      sort_order: 2,
      depends_on: ["bbbbbbb9-9999-4999-8999-999999999999"],
    });
    const workable = task({
      id: "bbbbbbb3-3333-4333-8333-333333333333",
      title: "Next real step",
      sort_order: 3,
    });
    const all = [a, blocked, workable];
    expect(nextActionableTask(a, all)?.id).toBe(workable.id);
    expect(nextActionableTask(a, [a])).toBeNull();
  });

  it("only the steps the card can finish itself are completable", () => {
    expect(isCompletableTaskAction("complete_task")).toBe(true);
    expect(isCompletableTaskAction("wait_for_dependency")).toBe(false);
  });
});
