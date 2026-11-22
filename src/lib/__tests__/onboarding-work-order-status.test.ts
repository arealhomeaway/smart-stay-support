import { describe, expect, it } from "bun:test";
import { instructionsToWrite, isStepGuidance, pickTemplateInstructions, workOrderStatusLabel } from "../onboarding-work-order-status";

describe("Breezeway status on a Task", () => {
  it("shows Scheduled, In Progress and Completed from Breezeway", () => {
    expect(workOrderStatusLabel("new", "Created", "2026-11-24")).toBe("Scheduled");
    expect(workOrderStatusLabel("in_progress", "In Progress", "2026-11-17")).toBe("In Progress");
    expect(workOrderStatusLabel("finished", "Finished", "2026-11-17")).toBe("Completed");
    expect(workOrderStatusLabel("finished", "Approved", null)).toBe("Completed");
  });
  it("a deleted work order reads as Canceled", () => {
    expect(workOrderStatusLabel("deleted", "Deleted", "2026-11-20")).toBe("Canceled");
  });
});

describe("work order instructions (Nov 22 correction)", () => {
  it("Breezeway gets exactly what was in the box, never ours plus the template's", () => {
    expect(instructionsToWrite("Paint the two bedrooms.", "Template steps")).toBe("Paint the two bedrooms.");
  });
  it("an emptied box empties the instructions", () => {
    expect(instructionsToWrite("", "Template steps")).toBe("");
  });
  it("changes nothing when Breezeway already shows the box text", () => {
    expect(instructionsToWrite("Template steps\r\n", "Template steps")).toBeNull();
    expect(instructionsToWrite("", null)).toBeNull();
  });
  it("a Task's step guidance is recognised so it is never used as a template's text", () => {
    expect(isStepGuidance("About this step:\nDraft this now")).toBe(true);
    expect(isStepGuidance("Please conduct the Standard Inspection.")).toBe(false);
  });
  it("the template's own words win over a copy someone added lines to", () => {
    const pure = "Please conduct the Standard Inspection.\n\nhttps://arha.fillout.com/standard";
    const picked = pickTemplateInstructions([
      { taskId: 2, text: `Project Manager Name: A\n\n${pure}` },
      { taskId: 1, text: pure },
    ]);
    expect(picked).toEqual({ text: pure, fromTaskId: 1 });
  });
  it("step guidance and empty work orders never count", () => {
    expect(pickTemplateInstructions([{ taskId: 1, text: "About this step:\nDraft this now" }, { taskId: 2, text: null }])).toBeNull();
  });
});
