import { describe, expect, it } from "bun:test";
import {
  breezewayStepSummary,
  breezewayTitleDefault,
  nextBreezewayTitle,
  stripWorkOrderPrefix,
} from "../onboarding-breezeway";

const DETAIL = `About this step:
Draft this now so the staging team can be booked as soon as we have access.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Setting out Essentials template.
2. Choose the date.

Done when:
The work order is in Breezeway with a date.`;

describe("36: Breezeway Description defaults to the step's short summary", () => {
  it("uses the About this step text only", () => {
    expect(breezewayStepSummary(DETAIL)).toBe("Draft this now so the staging team can be booked as soon as we have access.");
  });
  it("never carries the Instructions or Done when text", () => {
    const s = breezewayStepSummary(DETAIL);
    expect(s).not.toContain("Instructions");
    expect(s).not.toContain("Dispatch to Breezeway");
    expect(s).not.toContain("Done when");
  });
  it("reads About this step written on one line", () => {
    expect(breezewayStepSummary("About this step: Book the cleaner.\nInstructions:\n1. Call.")).toBe("Book the cleaner.");
  });
  it("without About this step, uses the first sentence of the step description", () => {
    expect(breezewayStepSummary("Hang the art in the living room. Use the level.\nThen photograph it.")).toBe(
      "Hang the art in the living room.",
    );
  });
  it("skips a heading and a list number to find the first sentence", () => {
    expect(breezewayStepSummary("Instructions:\n1. Check the smoke alarms. Replace batteries.")).toBe("Check the smoke alarms.");
  });
  it("falls back to the Task description when the detail is empty", () => {
    expect(breezewayStepSummary(null, "Inspect the roof. Note any damage.")).toBe("Inspect the roof.");
    expect(breezewayStepSummary(null, null)).toBe("");
  });
});

describe("37: Breezeway Title defaults to the chosen template's name", () => {
  it("shows the template name once a template is chosen", () => {
    expect(breezewayTitleDefault("Draft work order: Final inspection", "New House Setup - Final Inspection")).toBe(
      "New House Setup - Final Inspection",
    );
  });
  it("before a template is chosen, shows the Task title without Work order: or Draft work order:", () => {
    expect(breezewayTitleDefault("Draft work order: Install TV mounts", null)).toBe("Install TV mounts");
    expect(breezewayTitleDefault("Work order: Set out essentials")).toBe("Set out essentials");
    expect(stripWorkOrderPrefix("  draft WORK ORDER:  Unbox deliveries")).toBe("Unbox deliveries");
  });
  it("choosing a different template updates a title the user has not edited", () => {
    const first = breezewayTitleDefault("Draft work order: Final inspection", null);
    const a = nextBreezewayTitle(first, first, "New House Setup - Final Inspection");
    expect(a).toBe("New House Setup - Final Inspection");
    expect(nextBreezewayTitle(a, "New House Setup - Final Inspection", "New House Setup - Install TV Mounts")).toBe(
      "New House Setup - Install TV Mounts",
    );
  });
  it("keeps a title the user edited when the template changes", () => {
    expect(
      nextBreezewayTitle("Final inspection, check gate code", "New House Setup - Final Inspection", "New House Setup - Install TV Mounts"),
    ).toBe("Final inspection, check gate code");
  });
});
