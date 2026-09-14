import { describe, expect, it } from "bun:test";
import { nextStageCapture, stageCompletionBlockers, type StageCapture } from "../onboarding-stage";
import type { WorkflowTask } from "../onboarding-workflow";

const input = {
  current: null as StageCapture | null,
  stage: "phase1_inspection",
  expectedRevision: 0,
  action: "save" as const,
  observation: "Guest readiness inspected",
  evidenceIds: ["photo-1"],
  reason: "",
  actor: "staff",
  canReview: false,
  blockers: [] as string[],
  now: "2026-09-14T00:00:00Z",
};

describe("native stage revisions", () => {
  it("preserves the approved capture when reopened with a reason", () => {
    const submitted = nextStageCapture({ ...input, action: "submit" });
    const approved = nextStageCapture({
      ...input,
      current: submitted,
      expectedRevision: 1,
      action: "approve",
      canReview: true,
    });
    const reopened = nextStageCapture({
      ...input,
      current: approved,
      expectedRevision: 2,
      action: "reopen",
      canReview: true,
      reason: "New damage found",
      observation: "Must not overwrite the approved capture",
    });
    expect(approved.status).toBe("complete");
    expect(reopened.status).toBe("correction_required");
    expect(reopened.observation).toBe(approved.observation);
    expect(reopened.revision).toBe(3);
  });
  it("rejects stale revisions and editing a submitted capture", () => {
    const submitted = nextStageCapture({ ...input, action: "submit" });
    expect(() => nextStageCapture({ ...input, current: submitted })).toThrow("changed");
    expect(() => nextStageCapture({ ...input, current: submitted, expectedRevision: 1 })).toThrow(
      "locked",
    );
  });
  it("requires a reviewer and a correction reason", () => {
    const submitted = nextStageCapture({ ...input, action: "submit" });
    expect(() =>
      nextStageCapture({ ...input, current: submitted, expectedRevision: 1, action: "approve" }),
    ).toThrow("Director");
    expect(() =>
      nextStageCapture({
        ...input,
        current: submitted,
        expectedRevision: 1,
        action: "return",
        canReview: true,
      }),
    ).toThrow("reason");
  });
  it("blocks submission and approval when readiness changed", () => {
    expect(() =>
      nextStageCapture({ ...input, action: "submit", blockers: ["Required work is open"] }),
    ).toThrow("not ready");
    const submitted = nextStageCapture({ ...input, action: "submit" });
    expect(() =>
      nextStageCapture({
        ...input,
        current: submitted,
        expectedRevision: 1,
        action: "approve",
        canReview: true,
        blockers: ["Missing evidence"],
      }),
    ).toThrow("Missing evidence");
  });
  it("excludes furnishing children from No Furnishings readiness", () => {
    const tasks = [
      { id: "parent", title: "Design plan", stage: input.stage, status: "open" },
      {
        id: "child",
        title: "Record dimensions",
        parent_task_id: "parent",
        stage: input.stage,
        status: "open",
      },
    ] as WorkflowTask[];
    expect(
      stageCompletionBlockers(input.stage, tasks, {
        furnishing_scope: "no_furnishing",
        modules: [],
      }).length,
    ).toBe(0);
    expect(
      stageCompletionBlockers(input.stage, tasks, {
        furnishing_scope: "full_furnishing",
        modules: [],
      }).length,
    ).toBe(2);
  });
});
