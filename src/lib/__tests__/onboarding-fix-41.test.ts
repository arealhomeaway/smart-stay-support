// Fix 41 (Nov 12): onboarding home summary chips and Plan tab folding.
import { describe, expect, it } from "bun:test";
import { planStageOpenByDefault, stepperFor, summaryChips, type BoardTask } from "../onboarding-board";

describe("41 summary chips", () => {
  it("shows owner type and project status, never the stage", () => {
    const c = summaryChips({ ownerType: "Active Owner", activeOwner: true, projectStatus: "Staging/Furniture Setup" });
    expect(c).toEqual({ ownerType: "Active Owner", projectStatus: "Staging/Furniture Setup" });
    expect(Object.values(c)).not.toContain("Intake");
  });
  it("an enrolled home with no Owner Type still reads Active Owner; values not set show no chip", () => {
    expect(summaryChips({ ownerType: null, activeOwner: true, projectStatus: "" })).toEqual({ ownerType: "Active Owner", projectStatus: null });
    expect(summaryChips({ ownerType: " ", activeOwner: false, projectStatus: null })).toEqual({ ownerType: null, projectStatus: null });
  });
});

describe("41 Plan tab folding", () => {
  it("only the current stage starts open", () => {
    const t = (id: string, stage: string, status: string) => ({ id, stage, status, due_on: null, completed_at: null }) as unknown as BoardTask;
    const stepper = stepperFor([t("1", "intake", "complete"), t("2", "design", "open"), t("3", "design", "complete")]);
    const open = [0, 1, 2, 3, 4, 5].filter((i) => planStageOpenByDefault(i, stepper));
    expect(open).toEqual([stepper.current - 1]);
    expect(stepper.steps[0]!.note).toBe("Done");
  });
});
