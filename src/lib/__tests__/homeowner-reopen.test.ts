import { describe, expect, it } from "bun:test";
import { canChangeOwnEntry, homeownerUpdatedLine, hoursChangeProblem } from "@/lib/homeowner-reopen";
import { answeredRows, needsRows, type HomeownerStatusData } from "@/lib/homeowner-status";

const original = { activity: "Called the insurance agent", entry_date: "2026-11-12", minutes: 45 };
const TODAY = "2026-11-18";
const edit = (over: Partial<Parameters<typeof hoursChangeProblem>[0]> = {}) =>
  ({ mode: "edit" as const, activity: original.activity, entryDate: original.entry_date, minutes: original.minutes, note: "", newFiles: 0, ...over });

describe("homeowner reopens her hours (Nov 18)", () => {
  it("lets her change only her own current entry, never in the staff preview", () => {
    expect(canChangeOwnEntry({ owner_user_id: "me" }, "me", false)).toBe(true);
    expect(canChangeOwnEntry({ owner_user_id: "co-owner" }, "me", false)).toBe(false);
    expect(canChangeOwnEntry({ owner_user_id: "me", superseded: true }, "me", false)).toBe(false);
    expect(canChangeOwnEntry({ owner_user_id: "me" }, "me", true)).toBe(false);
  });
  it("refuses a save with nothing changed", () => {
    expect(hoursChangeProblem(edit(), original, TODAY)).toBe("Nothing changed.");
  });
  it("accepts a new time, date or description", () => {
    expect(hoursChangeProblem(edit({ minutes: 60 }), original, TODAY)).toBeNull();
    expect(hoursChangeProblem(edit({ entryDate: "2026-11-11" }), original, TODAY)).toBeNull();
    expect(hoursChangeProblem(edit({ activity: "Called the agent and the HOA" }), original, TODAY)).toBeNull();
  });
  it("keeps the hours limits: 1 to 1440 minutes, no future date", () => {
    expect(hoursChangeProblem(edit({ minutes: 0 }), original, TODAY)).toBe("Enter the time you spent, up to 24 hours.");
    expect(hoursChangeProblem(edit({ minutes: 1441 }), original, TODAY)).toBe("Enter the time you spent, up to 24 hours.");
    expect(hoursChangeProblem(edit({ entryDate: "2026-11-19" }), original, TODAY)).toBe("Choose a date no later than today.");
  });
  it("Add more needs a note or a file", () => {
    expect(hoursChangeProblem({ ...edit(), mode: "add" }, original, TODAY)).toBe("Add a note or a file first.");
    expect(hoursChangeProblem({ ...edit(), mode: "add", newFiles: 1 }, original, TODAY)).toBeNull();
    expect(hoursChangeProblem({ ...edit(), mode: "add", note: "Receipt attached" }, original, TODAY)).toBeNull();
  });
});

describe("the team sees Homeowner updated [item] on [date]", () => {
  it("names the item and the Central date", () => {
    expect(homeownerUpdatedLine("Hours on Nov 12", "2026-11-18T03:30:00Z")).toBe("Homeowner updated Hours on Nov 12 on Nov 17");
    expect(homeownerUpdatedLine("QA Order A", "2026-11-18T18:00:00Z")).toBe("Homeowner updated QA Order A on Nov 18");
  });
  const H = "home-1";
  const NOW = new Date("2026-11-18T18:00:00Z");
  const data: HomeownerStatusData = {
    cards: [], reviews: [], cardReviews: {}, approvals: [], planOn: { [H]: true }, homeLabels: { [H]: "1399 Foxtail Ln" },
    updates: [
      { id: "u1", propertyId: H, title: "Choose kitchen items", taskId: "t1", at: "2026-11-18T16:00:00Z" },
      { id: "u2", propertyId: H, title: "Old change", taskId: null, at: "2026-11-01T16:00:00Z" },
    ],
  };
  it("lists a change from the last 7 days in My homeowners, with its Task", () => {
    const rows = answeredRows(data, new Set([H]), NOW);
    expect(rows.map((r) => r.line)).toEqual(["Homeowner updated Choose kitchen items on Nov 18"]);
    expect(rows[0]?.taskId).toBe("t1");
  });
  it("leaves Needs you now unchanged", () => {
    expect(needsRows(data, new Set([H]), NOW)).toEqual([]);
  });
});
