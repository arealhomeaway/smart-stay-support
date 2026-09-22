import { describe, expect, it } from "bun:test";
import type { WorkflowTask } from "@/lib/onboarding-workflow";
import {
  buildWorkstreams,
  overallProgress,
  readyNowQueue,
  trackForTask,
} from "@/lib/onboarding-workstreams";

function task(partial: Partial<WorkflowTask> & { id: string; title: string }): WorkflowTask {
  return {
    property_id: "p1",
    stage: "documents_assessment",
    detail: null,
    assigned_to: null,
    assigned_seat: null,
    due_on: null,
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
    sort_order: 0,
    completed_at: null,
    ...partial,
  } as WorkflowTask;
}

describe("workstream tracks", () => {
  it("sorts work into the track its wording points at", () => {
    expect(trackForTask({ title: "Begin utility setup", stage: "intake_identity" })).toBe(
      "access_utilities",
    );
    expect(trackForTask({ title: "Order living room furniture", stage: "intake_identity" })).toBe(
      "furnishing_staging",
    );
    expect(trackForTask({ title: "Schedule listing photos", stage: "intake_identity" })).toBe(
      "media_listing",
    );
  });

  it("falls back to the stage when the wording says nothing", () => {
    expect(trackForTask({ title: "Kickoff call", stage: "fieldwork_setup_review" })).toBe(
      "furnishing_staging",
    );
    expect(trackForTask({ title: "Kickoff call", stage: "handoff_acceptance" })).toBe(
      "ops_readiness",
    );
  });

  it("never loses a task to an unknown stage", () => {
    expect(trackForTask({ title: "Kickoff call", stage: "something_new" })).toBe("ops_readiness");
  });
});

describe("ready now", () => {
  const tasks = [
    task({ id: "a", title: "Begin utility setup", due_on: "2026-01-10", sort_order: 1 }),
    task({
      id: "b",
      title: "Order living room furniture",
      depends_on: ["a"],
      sort_order: 2,
    }),
    task({ id: "c", title: "Schedule listing photos", due_on: "2026-01-05", sort_order: 3 }),
    task({ id: "d", title: "Verify the required documents", status: "complete", sort_order: 4 }),
  ];

  it("lists every open step, soonest first", () => {
    const queue = readyNowQueue(buildWorkstreams(tasks));
    expect(queue.map((q) => q.view.task.id)).toEqual(["c", "a", "b"]);
  });

  it("names the track next to each ready step", () => {
    const queue = readyNowQueue(buildWorkstreams(tasks));
    expect(queue[0]?.trackLabel).toBe("Media & Listing");
  });

  it("keeps a step with an open prerequisite workable", () => {
    const furnishing = buildWorkstreams(tasks).find((g) => g.key === "furnishing_staging");
    expect(furnishing?.ready.map((v) => v.task.id)).toEqual(["b"]);
    expect(furnishing?.waiting).toHaveLength(0);
  });


  it("counts finished work into the progress meters", () => {
    const groups = buildWorkstreams(tasks);
    const ops = groups.find((g) => g.key === "ops_readiness");
    expect(ops?.percent).toBe(100);
    expect(overallProgress(groups)).toEqual({ done: 1, total: 4, percent: 25 });
  });
});
