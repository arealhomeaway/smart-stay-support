/**
 * The authoritative onboarding state model.
 *
 * These tests cover the state-integrity rules the beta depends on: one
 * lifecycle, phase- and date-aware release, accepted-plan locking, and a
 * handoff gate that always explains itself.
 */
import { describe, expect, it } from "bun:test";
import type { WorkflowTask } from "@/lib/onboarding-workflow";
import {
  buildReleaseContext,
  deriveLifecycle,
  handoffReadiness,
  isPostLock,
  releaseState,
  type StateProperty,
} from "@/lib/onboarding-state";

function property(over: Partial<StateProperty> = {}): StateProperty {
  return {
    id: "p1",
    name: "1039 Swinton Way",
    lifecycle_status: "onboarding",
    onboarding_stage: "phase1_inspection",
    access_notes: "Front lockbox",
    actual_access_on: "2026-01-05",
    planned_closing_on: "2026-01-01",
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
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const PROJECT = { id: "pr1", status: "active" as string | null, completed_at: null };

describe("one authoritative lifecycle", () => {
  it("treats a home with no project as not started, whatever legacy fields say", () => {
    const life = deriveLifecycle({
      property: property({ onboarding_stage: "phase4_purchasing" }),
      project: null,
      tasks: [],
      handoff: null,
    });
    expect(life.notStarted).toBe(true);
  });

  it("lets acceptance override a stale open handoff row", () => {
    const life = deriveLifecycle({
      property: property({
        lifecycle_status: "active_operations",
        handoff_accepted_at: "2026-02-01T00:00:00.000Z",
      }),
      project: PROJECT,
      tasks: [task()],
      handoff: { id: "h", status: "requested", gate_step: "kati_review" },
    });
    expect(life.accepted).toBe(true);
    expect(life.locked).toBe(true);
  });
});

describe("release is phase and date aware", () => {
  it("does not release later phases before access is confirmed", () => {
    const ctx = buildReleaseContext({
      property: property({ actual_access_on: null, access_notes: null }),
      project: PROJECT,
      tasks: [task({ stage: "phase4_purchasing" })],
      handoff: null,
    });
    const v = releaseState(task({ stage: "phase4_purchasing" }), [], ctx);
    expect(v.canComplete).toBe(false);
    expect(v.reason).toContain("Access");
  });

  it("keeps a later phase Future until the phase before it is finished", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", stage: "phase4_purchasing" })];
    const ctx = buildReleaseContext({
      property: property(),
      project: PROJECT,
      tasks,
      handoff: null,
    });
    expect(releaseState(tasks[0]!, tasks, ctx).state).toBe("ready");
    const later = releaseState(tasks[1]!, tasks, ctx);
    expect(later.state).toBe("future");
    expect(later.canComplete).toBe(false);
  });
});

describe("an accepted plan is locked", () => {
  it("refuses completion once the home is with Operations", () => {
    const tasks = [task()];
    const ctx = buildReleaseContext({
      property: property({
        lifecycle_status: "active_operations",
        handoff_accepted_at: "2026-02-01T00:00:00.000Z",
      }),
      project: PROJECT,
      tasks,
      handoff: null,
    });
    expect(releaseState(tasks[0]!, tasks, ctx).canComplete).toBe(false);
  });

  it("marks work created after the lock as outside that plan", () => {
    expect(
      isPostLock({ created_at: "2026-03-01T00:00:00.000Z", status: "open" }, "2026-02-01T00:00:00.000Z"),
    ).toBe(true);
    expect(
      isPostLock({ created_at: "2026-01-01T00:00:00.000Z", status: "open" }, "2026-02-01T00:00:00.000Z"),
    ).toBe(false);
  });
});

describe("the handoff gate explains itself", () => {
  it("blocks and names every failing condition", () => {
    const r = handoffReadiness(
      { property: property(), project: PROJECT, tasks: [task()], handoff: null },
      [{ key: "open_work", label: "Open work", detail: "1 step is still open.", passed: false, blocking: true }],
      { pendingFacts: 1, openFinancials: 2 },
    );
    expect(r.ready).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
    expect(r.reasons.every((x) => x.detail.length > 0)).toBe(true);
  });

  it("opens the gate when nothing is outstanding", () => {
    const r = handoffReadiness(
      {
        property: property(),
        project: PROJECT,
        tasks: [task({ status: "complete", completed_at: "2026-01-06T00:00:00.000Z" })],
        handoff: null,
      },
      [{ key: "open_work", label: "Open work", detail: "All steps are complete.", passed: true, blocking: true }],
      {},
    );
    expect(r.ready).toBe(true);
  });
});
