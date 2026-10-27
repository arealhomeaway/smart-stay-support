import { describe, expect, it } from "bun:test";
import { bulkPreviewSentence, planTemplateBulkEdit, type TemplateBulkStep } from "../template-bulk-edit";

const step = (id: string, partial: Partial<TemplateBulkStep> = {}): TemplateBulkStep => ({
  id,
  title: `Step ${id}`,
  stage: "Intake",
  sort_order: Number(id) * 10,
  functional_role: "onboarding_project_manager",
  is_required: true,
  blocks_handoff: false,
  offset_days: 1,
  schedule_anchor: "project_created",
  offset_unit: "calendar",
  requires_owner_approval: false,
  tags: [],
  ...partial,
});

const steps = [step("1"), step("2"), step("3")];
const options = { stages: ["Intake", "Preparation"], roleName: (role: string | null) => role ?? "Unassigned" };

describe("Workflow Template bulk edit preview", () => {
  it("plans one due-date change across three steps", () => {
    const plan = planTemplateBulkEdit(steps, ["1", "2", "3"], {
      dueRule: { offsetDays: 5, scheduleAnchor: "actual_access" },
    }, options);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.changes).toHaveLength(3);
    expect(plan.changes.every((change) => change.after["offset_days"] === 5)).toBe(true);
    expect(bulkPreviewSentence(plan)).toBe("This will change 3 steps: due date to 5 days after confirmed access date.");
  });

  it("plans business days without touching other fields", () => {
    const plan = planTemplateBulkEdit(steps, ["1", "2"], { offsetUnit: "business" }, options);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.changes.map((change) => change.after["offset_unit"])).toEqual(["business", "business"]);
    expect(plan.changes[0]!.after["functional_role"]).toBe("onboarding_project_manager");
  });

  it("skips homeowner and Active Owner steps when Blocks handoff is Yes", () => {
    const locked = [
      step("1", { requires_owner_approval: true }),
      step("2", { tags: ["active_owner"] }),
      step("3"),
    ];
    const plan = planTemplateBulkEdit(locked, ["1", "2", "3"], { blocksHandoff: true }, options);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.changes.map((change) => change.stepId)).toEqual(["3"]);
    expect(plan.skipped).toHaveLength(2);
    expect(plan.handoffSkipMessage).toBe("2 homeowner or Active Owner steps were left as non-blocking.");
  });

  it("keeps a stage move as a real change and rejects an unknown stage", () => {
    const plan = planTemplateBulkEdit(steps, ["2", "1"], { stage: "Preparation" }, options);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.changes.map((change) => change.stepId)).toEqual(["2", "1"]);
    expect(planTemplateBulkEdit(steps, ["1"], { stage: "Missing" }, options)).toEqual({
      ok: false,
      error: "Choose a stage in this template.",
    });
  });

  it("does not save when every selected step already matches", () => {
    expect(planTemplateBulkEdit(steps, ["1"], { offsetUnit: "calendar" }, options)).toEqual({
      ok: false,
      error: "The selected steps already have these settings.",
    });
  });
});
