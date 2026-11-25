import { describe, expect, it } from "bun:test";
import {
  DEFAULT_STANDARDS, breezewayRequirementsLink, canChangeLockedDue, canEditStandards, dueChangeRule,
  dueForNewTicket, isBreezewayReviewType, standardFor,
} from "../guest-ready-standards";

const today = "2026-11-24";

describe("guest-ready standards", () => {
  it("starts with the seven rows in order, three locked", () => {
    expect(DEFAULT_STANDARDS.map((s) => [s.label, s.locked])).toEqual([
      ["Cleaning review", true],
      ["Priority 1, guest-impacting (heat, AC, leaks, power)", true],
      ["Arrival check", true],
      ["Lawn care review", false],
      ["Inspection review", false],
      ["Minor items (paint touch-ups, weeds)", false],
      ["Pest control", false],
    ]);
  });
  it("cleaning review is due the day of the clean and locked", () => {
    const s = standardFor(DEFAULT_STANDARDS, { workTypeName: "Cleaning Review Log", priority: "p3" });
    expect(dueForNewTicket(s, "p3", today)).toEqual({ dueOn: today, locked: true, note: "Cleaning reviews are always due before 4:00 PM." });
  });
  it("a P1 ticket with no row of its own is due the same day and locked", () => {
    const s = standardFor(DEFAULT_STANDARDS, { workTypeName: "Immediate maintenance", priority: "p1" });
    expect(dueForNewTicket(s, "p1", today)).toMatchObject({ dueOn: today, locked: true });
  });
  it("Not set keeps today's rule: P3 in 7 days, team can change", () => {
    const s = standardFor(DEFAULT_STANDARDS, { workTypeName: "Quarterly inspection review", priority: "p3" });
    expect(dueForNewTicket(s, "p3", today)).toEqual({ dueOn: "2026-12-01", locked: false, note: null });
    expect(dueForNewTicket(null, "p2", today)).toEqual({ dueOn: today, locked: false, note: null });
  });
  it("only Supervisors, Directors and Admin change a locked date, with a reason", () => {
    expect(canEditStandards(["admin"])).toBe(true);
    expect(canChangeLockedDue(["manager"], { opsSupervisor: true })).toBe(true);
    expect(canChangeLockedDue(["manager"], { opsDirector: true })).toBe(true);
    expect(canChangeLockedDue(["tech"], {})).toBe(false);
    expect(dueChangeRule(true, false, true)).toBe("view");
    expect(dueChangeRule(true, true, true)).toBe("edit_with_reason");
    expect(dueChangeRule(false, false, true)).toBe("edit");
  });
  it("review tickets open the Breezeway report, else the task page", () => {
    expect(isBreezewayReviewType("Cleaning Review Log")).toBe(true);
    expect(isBreezewayReviewType("Immediate maintenance")).toBe(false);
    expect(breezewayRequirementsLink([{ taskPage: "t" , reportLink: null }, { reportLink: "r" }])).toBe("r");
    expect(breezewayRequirementsLink([{ taskPage: "t" }])).toBe("t");
  });
});
