/**
 * Onboarding QA: dependency state, overdue honesty and the handoff gate order.
 */
import { describe, expect, it } from "bun:test";
import { viewTask, type WorkflowTask } from "@/lib/onboarding-workflow";
import { GATE_STEPS, dependencyBlocked, isOverdue, nextGate } from "@/lib/onboarding";

const past = "2020-01-01";

function task(over: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: over.id ?? "t1",
    property_id: "p1",
    stage: "setup",
    title: "Install lockbox",
    detail: null,
    assigned_to: null,
    assigned_seat: null,
    due_on: past,
    due_on_source: null,
    due_on_overridden: false,
    schedule_anchor: null,
    schedule_offset_days: null,
    depends_on: null,
    parent_task_id: null,
    blocker: null,
    blocks_handoff: false,
    evidence_required: false,
    evidence_note: null,
    requires_owner_approval: false,
    owner_approval_status: "not_required",
    exception_reason: null,
    carryover_of: null,
    carryover_reason: null,
    linked_ticket_id: null,
    status: "open",
    sort_order: 1,
    completed_at: null,
    ...over,
  };
}

describe("overdue is only claimed for workable tasks", () => {
  it("marks a plain past-due, unblocked task overdue", () => {
    const t = task();
    expect(viewTask(t, [t]).overdue).toBe(true);
  });

  it("does not mark a dependency-blocked task overdue", () => {
    const prereq = task({ id: "a", title: "Owner signs agreement", status: "open" });
    const dependent = task({ id: "b", depends_on: ["a"] });
    const view = viewTask(dependent, [prereq, dependent]);
    expect(view.status).toBe("not_ready");
    expect(view.overdue).toBe(false);
    expect(view.waitingOn).toEqual(["Owner signs agreement"]);
  });

  it("releases the dependent task once the prerequisite completes", () => {
    const prereq = task({ id: "a", status: "complete" });
    const dependent = task({ id: "b", depends_on: ["a"] });
    const view = viewTask(dependent, [prereq, dependent]);
    expect(dependencyBlocked(dependent, [prereq, dependent])).toEqual([]);
    expect(view.status).toBe("ready");
    expect(view.overdue).toBe(true); // now genuinely late
  });

  it("does not mark owner-waiting or explicitly blocked work overdue", () => {
    const owner = task({
      requires_owner_approval: true,
      owner_approval_status: "awaiting_owner",
    });
    const blocked = task({ blocker: "Utility not energized" });
    const carry = task({ status: "carryover" });
    expect(viewTask(owner, [owner]).overdue).toBe(false);
    expect(viewTask(blocked, [blocked]).overdue).toBe(false);
    expect(viewTask(carry, [carry]).overdue).toBe(false);
  });

  it("never marks completed work overdue", () => {
    expect(isOverdue({ due_on: past, status: "complete" })).toBe(false);
  });
});

describe("handoff gate order cannot be skipped", () => {
  it("advances one gate at a time in the approved sequence", () => {
    expect(GATE_STEPS[0]).toBe("kati_review");
    let step: string | null = GATE_STEPS[0];
    const seen: string[] = [];
    while (step) {
      seen.push(step);
      step = nextGate(step as never);
    }
    expect(seen).toEqual([...GATE_STEPS]);
  });
});
