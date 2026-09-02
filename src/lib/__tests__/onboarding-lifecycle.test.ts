/**
 * Onboarding lifecycle: stage derivation, next action, blockers and risk.
 * Covers the beta acceptance scenarios that are pure logic.
 */
import { describe, expect, it } from "bun:test";
import type { WorkflowTask } from "@/lib/onboarding-workflow";
import {
  activeBranches,
  deriveBlockers,
  deriveNextAction,
  deriveRisk,
  deriveStage,
  gateProgress,
  type ProjectProperty,
} from "@/lib/onboarding-lifecycle";

function property(over: Partial<ProjectProperty> = {}): ProjectProperty {
  return {
    id: "p1",
    name: "1039 Swinton Way",
    lifecycle_status: "onboarding",
    onboarding_stage: "phase1_inspection",
    onboarding_owner: null,
    access_notes: "Front lockbox",
    planned_closing_on: null,
    actual_access_on: "2026-01-05",
    handoff_accepted_at: null,
    ...over,
  };
}

function task(over: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "t1",
    property_id: "p1",
    stage: "phase1_inspection",
    title: "New House Assessment",
    detail: null,
    assigned_to: null,
    assigned_seat: null,
    due_on: "2026-01-10",
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

describe("stage derivation", () => {
  it("holds a home in Pre-Close until access exists", () => {
    const p = property({ access_notes: null, actual_access_on: null });
    expect(deriveStage({ property: p, tasks: [task()], handoff: null })).toBe("pre_close");
  });

  it("moves to the earliest phase with unfinished work once access is confirmed", () => {
    const tasks = [task({ id: "a", status: "complete" }), task({ id: "b", stage: "phase4_purchasing" })];
    expect(deriveStage({ property: property(), tasks, handoff: null })).toBe("furnishing_repairs");
  });

  it("reports review stages from the open handoff gate", () => {
    const handoff = { id: "h", property_id: "p1", status: "requested", gate_step: "kati_review" };
    expect(deriveStage({ property: property(), tasks: [task()], handoff })).toBe("director_review");
  });

  it("reports Live once operations accepted the home", () => {
    const p = property({ lifecycle_status: "active_operations" });
    expect(deriveStage({ property: p, tasks: [], handoff: null })).toBe("live");
  });
});

describe("next action", () => {
  it("says no team action is available before access", () => {
    const p = property({ access_notes: null, actual_access_on: null, planned_closing_on: "2026-02-01" });
    const next = deriveNextAction({ property: p, tasks: [task()], handoff: null });
    expect(next.waiting).toBe(true);
    expect(next.headline).toBe("Waiting for closing and access");
  });

  it("names the single actionable step, oldest due date first", () => {
    const tasks = [
      task({ id: "a", title: "Order furniture", due_on: "2026-03-01" }),
      task({ id: "b", title: "Schedule assessment", due_on: "2026-01-06" }),
    ];
    const next = deriveNextAction({ property: property(), tasks, handoff: null });
    expect(next.headline).toBe("Schedule assessment");
    expect(next.taskId).toBe("b");
    expect(next.waiting).toBe(false);
  });

  it("asks for handoff when every step is finished", () => {
    const next = deriveNextAction({
      property: property(),
      tasks: [task({ status: "complete" })],
      handoff: null,
    });
    expect(next.headline).toBe("Request handoff");
  });

  it("explains the wait when nothing is actionable", () => {
    const tasks = [task({ id: "a", requires_owner_approval: true, owner_approval_status: "awaiting_owner" })];
    const next = deriveNextAction({ property: property(), tasks, handoff: null });
    expect(next.waiting).toBe(true);
    expect(next.detail).toContain("Homeowner");
  });
});

describe("blockers are first class", () => {
  it("names what, who owns the next step and follow-up timing", () => {
    const tasks = [
      task({ id: "a", requires_owner_approval: true, owner_approval_status: "awaiting_owner", due_on: "2026-01-09" }),
    ];
    const [b] = deriveBlockers({ property: property(), tasks, handoff: null });
    expect(b?.kind).toBe("owner");
    expect(b?.owner).toBe("Homeowner");
    expect(b?.followUp).toBe("2026-01-09");
  });

  it("treats missing access as a blocker owned by closing", () => {
    const p = property({ access_notes: null, actual_access_on: null });
    const [b] = deriveBlockers({ property: p, tasks: [], handoff: null });
    expect(b?.kind).toBe("access");
  });
});

describe("risk is derived and explained", () => {
  it("stays on track with clean, future work", () => {
    const tasks = [task({ due_on: "2099-01-01" })];
    const risk = deriveRisk({ property: property(), tasks, handoff: null });
    expect(risk.level).toBe("on_track");
    expect(risk.reasons).toEqual([]);
  });

  it("explains why a project is at risk", () => {
    const tasks = [
      task({ id: "a", due_on: "2020-01-01" }),
      task({ id: "b", due_on: "2020-01-02" }),
    ];
    const risk = deriveRisk({ property: property(), tasks, handoff: null });
    expect(risk.level).toBe("at_risk");
    expect(risk.reasons.join(" ")).toContain("overdue");
  });
});

describe("conditional activation and gates", () => {
  it("only lists branches the home actually carries", () => {
    const branches = activeBranches([task({ title: "Deep clean before photos" })]);
    expect(branches.map((b) => b.key)).toContain("cleaning");
    expect(branches.map((b) => b.key)).not.toContain("landscaping");
  });

  it("never marks a future gate current", () => {
    const gates = gateProgress(
      { id: "h", property_id: "p1", status: "requested", gate_step: "kati_review" },
      false,
    );
    expect(gates[0]?.state).toBe("current");
    expect(gates[1]?.state).toBe("upcoming");
    expect(gates.filter((g) => g.state === "current")).toHaveLength(1);
  });
});
