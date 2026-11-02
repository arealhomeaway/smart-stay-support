import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dispatchBasicsProblem } from "@/lib/pilot-dispatch";
import { guessMaintenanceCategory } from "@/lib/work-entry";

describe("staff-composed Breezeway sends", () => {
  it("refuses an undated send", () => {
    expect(dispatchBasicsProblem({ scheduledDate: "", assigneeIds: [5] })).toBe("Choose the date for this work before sending it to Breezeway.");
  });
  it("refuses an unassigned send", () => {
    expect(dispatchBasicsProblem({ scheduledDate: "2026-11-10", assigneeIds: [] })).toBe("Choose who is doing the work before sending it to Breezeway.");
  });
  it("allows a dated, assigned send", () => {
    expect(dispatchBasicsProblem({ scheduledDate: "2026-11-10", assigneeIds: [5] })).toBeNull();
  });
  it("server validator enforces the rule before any Breezeway call", () => {
    const src = readFileSync("src/lib/breezeway-outbound.functions.ts", "utf8");
    const v = src.indexOf("dispatchBasicsProblem({ scheduledDate: date");
    expect(v).toBeGreaterThan(0);
    expect(v < src.indexOf("createOutboundTask(data")).toBe(true);
  });
});

describe("maintenance category from the description", () => {
  it("fills common repairs", () => {
    expect(guessMaintenanceCategory("Kitchen sink is leaking under the cabinet")).toBe("water_intrusion");
    expect(guessMaintenanceCategory("AC not cooling upstairs")).toBe("hvac");
    expect(guessMaintenanceCategory("Toilet keeps running")).toBe("plumbing");
    expect(guessMaintenanceCategory("Dishwasher won't start")).toBe("appliance");
  });
  it("leaves it empty when unclear", () => {
    expect(guessMaintenanceCategory("guest called about something")).toBeNull();
  });
});

describe("onboarding sends may leave the person blank", () => {
  it("onboarding Task: date required, person optional", () => {
    expect(dispatchBasicsProblem({ scheduledDate: "", assigneeIds: [], sourceType: "onboarding_task" })).toBe("Choose the date for this work before sending it to Breezeway.");
    expect(dispatchBasicsProblem({ scheduledDate: "2026-11-10", assigneeIds: [], sourceType: "onboarding_task" })).toBeNull();
  });
  it("Ticket still needs a person", () => {
    expect(dispatchBasicsProblem({ scheduledDate: "2026-11-10", assigneeIds: [], sourceType: "ticket" })).toBe("Choose who is doing the work before sending it to Breezeway.");
  });
  it("server passes the source to the same rule", () => {
    const src = readFileSync("src/lib/breezeway-outbound.functions.ts", "utf8");
    expect(src.includes("sourceType: source.sourceType })")).toBe(true);
  });
});
