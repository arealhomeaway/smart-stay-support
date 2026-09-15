import { expect, it } from "bun:test";
import { onboardingTaskAccess, assertAssignedTaskPatch } from "../onboarding-task-access.server";
import {
  addOnboardingNote,
  submitOwnerApproval,
  recordOwnerTaskDecision,
  confirmApprovalRequirement,
  overrideOnboardingTaskDate,
  setPropertyLifecycle,
  requestHandoff,
} from "../onboarding.server";
import {
  saveScheduleAnchors,
  previewScheduleRecalc,
  applyScheduleRecalc,
  setTaskSchedule,
} from "../onboarding-schedule.server";

function client(assignedTo: string, lead = false, property = "home") {
  let writes = 0;
  const db = {
    rpc: async (name: string) => ({ data: name === "is_onboarding_staff", error: null }),
    from: (table: string) => {
      const row = {
        id: "task",
        property_id: property,
        assigned_to: assignedTo,
        archived_at: null,
        requires_owner_approval: true,
        owner_approval_status: "pending",
      };
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: row, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data:
              table === "onboarding_projects" && lead
                ? [{ project_manager: "actor", director: null }]
                : [],
            error: null,
          }).then(resolve),
        insert: () => {
          writes++;
          throw new Error("unexpected write");
        },
        update: () => {
          writes++;
          throw new Error("unexpected write");
        },
      };
      return query;
    },
  };
  return { db, writes: () => writes };
}

it("field assignment does not authorize property lifecycle, handoff or scheduling actions", async () => {
  const { db, writes } = client("actor");
  const actions = [
    () =>
      setPropertyLifecycle(db as never, "actor", {
        propertyId: "home",
        status: "paused",
        reason: "Pause",
      }),
    () =>
      requestHandoff(db as never, "actor", {
        propertyId: "home",
        notes: "Ready",
        carryoverAccepted: false,
      }),
    () =>
      saveScheduleAnchors(db as never, "actor", {
        propertyId: "home",
        plannedClosingOn: null,
        actualClosingOn: null,
        actualAccessOn: null,
      }),
    () => previewScheduleRecalc(db as never, "actor", { propertyId: "home" }),
    () => applyScheduleRecalc(db as never, "actor", { propertyId: "home", taskIds: ["task"] }),
    () =>
      setTaskSchedule(db as never, "actor", {
        taskId: "task",
        anchor: null,
        offsetDays: null,
        manualOverride: false,
      }),
  ];
  for (const action of actions) {
    const message = await action().then(
      () => "allowed",
      (error: Error) => error.message,
    );
    expect(message).toContain("not assigned");
  }
  expect(writes()).toBe(0);
});

it("distinguishes assigned progress from project management and rejects unrelated callers", async () => {
  expect(await onboardingTaskAccess(client("actor").db as never, "actor", "home", "actor")).toEqual(
    { canManage: false },
  );
  expect(
    await onboardingTaskAccess(client("other", true).db as never, "actor", "home", "other"),
  ).toEqual({ canManage: true });
  const message = await onboardingTaskAccess(
    client("other").db as never,
    "actor",
    "home",
    "other",
  ).then(
    () => "allowed",
    (e: Error) => e.message,
  );
  expect(message).toContain("not assigned");
});

it("date overrides reject assignees and forward the viewed version and authenticated actor", async () => {
  const calls: unknown[] = [];
  const admin = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: "task", error: null };
    },
  };
  const input = {
    taskId: "task",
    expectedUpdatedAt: "2026-09-15T12:00:00Z",
    dueOn: null,
    reason: "Delivery date pending",
  };
  const denied = await overrideOnboardingTaskDate(
    client("actor").db as never,
    "actor",
    input,
    admin as never,
  ).then(
    () => "allowed",
    (error: Error) => error.message,
  );
  expect(denied).toContain("Only the project lead");
  expect(calls.length).toBe(0);
  expect(
    await overrideOnboardingTaskDate(
      client("other", true).db as never,
      "actor",
      input,
      admin as never,
    ),
  ).toEqual({ id: "task" });
  expect(calls).toEqual([
    {
      name: "override_onboarding_task_date",
      args: {
        _task_id: "task",
        _actor_id: "actor",
        _expected_updated_at: input.expectedUpdatedAt,
        _due_on: null,
        _reason: input.reason,
      },
    },
  ]);
  const stale = await overrideOnboardingTaskDate(
    client("other", true).db as never,
    "actor",
    input,
    {
      rpc: async () => ({ data: null, error: new Error("This task changed") }),
    } as never,
  ).then(
    () => "allowed",
    (error: Error) => error.message,
  );
  expect(stale).toContain("This task changed");
});

it("assigned progress cannot change evidence requirements, ownership, links or carryover", () => {
  const prior = {
    status: "open",
    evidence_required: true,
    assigned_to: "actor",
    depends_on: ["prerequisite"],
    property_id: "home",
  };
  assertAssignedTaskPatch(prior, {
    status: "blocked",
    blocker: "Waiting for access",
    evidence_note: "Recorded observation",
  });
  for (const patch of [
    { evidence_required: false },
    { assigned_to: "other" },
    { depends_on: [] },
    { property_id: "other" },
    { status: "carryover" },
  ]) {
    let rejected = false;
    try {
      assertAssignedTaskPatch(prior, patch);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }
});

it("denies unrelated direct approval actions before mutation", async () => {
  const { db, writes } = client("other");
  for (const action of [
    () =>
      submitOwnerApproval(db as never, "actor", { taskId: "task", version: "v1", note: "Review" }),
    () =>
      recordOwnerTaskDecision(db as never, "actor", {
        taskId: "task",
        approved: true,
        note: "Recorded answer",
      }),
  ]) {
    const message = await action().then(
      () => "allowed",
      (e: Error) => e.message,
    );
    expect(message).toContain("not assigned");
  }
  expect(writes()).toBe(0);
});

it("an assignee cannot waive their own approval requirement", async () => {
  const { db, writes } = client("actor");
  const message = await confirmApprovalRequirement(db as never, "actor", {
    taskId: "task",
    requiresOwnerApproval: false,
    reason: "Skip approval",
  }).then(
    () => "allowed",
    (e: Error) => e.message,
  );
  expect(message).toContain("Only the project lead");
  expect(writes()).toBe(0);
});

it("notes reject cross-property or unrelated task links before insertion", async () => {
  for (const [assignedTo, property] of [
    ["actor", "other-home"],
    ["other-user", "home"],
  ]) {
    const { db, writes } = client(assignedTo!, false, property);
    const message = await addOnboardingNote(db as never, "actor", {
      propertyId: "home",
      taskId: "task",
      body: "Observation",
      mentions: [],
    }).then(
      () => "allowed",
      (e: Error) => e.message,
    );
    expect(message === "allowed").toBe(false);
    expect(writes()).toBe(0);
  }
});
it("fails closed when supervisor capability cannot be verified", async () => {
  let queried = false;
  const db = {
    rpc: async () => ({ data: true, error: new Error("role lookup failed") }),
    from: () => {
      queried = true;
      throw new Error("unexpected query");
    },
  };
  const message = await onboardingTaskAccess(db as never, "actor", "home", "actor").then(
    () => "allowed",
    (e: Error) => e.message,
  );
  expect(message).toContain("Could not verify task access");
  expect(queried).toBe(false);
});
