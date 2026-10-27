import { describe, expect, it } from "bun:test";
import { homeTaskSelectable, planHomeTaskBulkEdit, homeBulkPreviewSentence, type HomeBulkTask } from "../home-task-bulk-edit";

const base = (id: string, extra: Partial<HomeBulkTask> = {}): HomeBulkTask => ({
  id, title: id, stage: "intake", status: "open", due_on: null, assigned_seat: null,
  is_required: true, blocks_handoff: false, requires_owner_approval: false, tags: [], ...extra,
});

describe("home plan bulk edit planner", () => {
  it("completed, done, carried-over, voided and exception Tasks cannot be selected", () => {
    expect(homeTaskSelectable(base("a"))).toBe(true);
    for (const t of [
      base("b", { status: "complete" }), base("c", { status: "done" }), base("d", { status: "carryover" }),
      base("e", { archived_at: "2026-10-01" }), base("f", { exception_at: "2026-10-01" }),
    ]) expect(homeTaskSelectable(t)).toBe(false);
  });

  it("refuses a plan that includes a completed Task", () => {
    const plan = planHomeTaskBulkEdit([base("a"), base("b", { status: "complete" })], ["a", "b"], { isRequired: false }, { stages: ["intake"] });
    expect(plan).toEqual({ ok: false, error: "These Tasks cannot be edited: b" });
  });

  it("skips Active Owner Tasks for Blocks handoff Yes with the approved message", () => {
    const plan = planHomeTaskBulkEdit([base("a"), base("o", { tags: ["active_owner"] })], ["a", "o"], { blocksHandoff: true }, { stages: ["intake"] });
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.handoffSkipMessage).toBe("1 homeowner or Active Owner Tasks were left as non-blocking.");
    expect(plan.changed.map((c) => c.taskId)).toEqual(["a"]);
  });

  it("says when the home would go from Ready to Not ready for handoff, and the reverse", () => {
    const tasks = [base("a"), base("b")];
    const worse = planHomeTaskBulkEdit(tasks, ["a"], { blocksHandoff: true }, { stages: ["intake"] });
    if (!worse.ok) throw new Error(worse.error);
    expect(worse.readiness.message).toBe("This home would go from Ready to Not ready for handoff.");
    const better = planHomeTaskBulkEdit([base("a", { blocks_handoff: true })], ["a"], { isRequired: false }, { stages: ["intake"] });
    if (!better.ok) throw new Error(better.error);
    expect(better.readiness.message).toBe("This home would go from Not ready to Ready for handoff.");
  });

  it("previews the home name and changes", () => {
    const plan = planHomeTaskBulkEdit([base("a"), base("b")], ["a", "b"], { dueOn: "2026-12-01", offsetUnit: "business" }, { stages: ["intake"] });
    if (!plan.ok) throw new Error(plan.error);
    expect(homeBulkPreviewSentence(plan, "1399 Foxtail Ln.")).toBe("This will change 2 Tasks on 1399 Foxtail Ln.: due date to 2026-12-01; business days.");
  });
});
