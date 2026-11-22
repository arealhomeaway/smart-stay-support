import { describe, expect, it } from "bun:test";
import { instructionsText, workOrderStatusLabel } from "../onboarding-work-order-status";

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

describe("work order instructions", () => {
  it("sends our description as the instructions, keeping a template's own text under it", () => {
    expect(instructionsText("Paint the two bedrooms.", "Template steps")).toBe("Paint the two bedrooms.\n\nTemplate steps");
    expect(instructionsText("Paint the two bedrooms.", null)).toBe("Paint the two bedrooms.");
  });
  it("changes nothing when Breezeway already shows ours or there is nothing to send", () => {
    expect(instructionsText("Paint  the two\nbedrooms.", "Paint the two bedrooms.")).toBeNull();
    expect(instructionsText("", "Template steps")).toBeNull();
  });
});
