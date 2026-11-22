import { describe, expect, it } from "bun:test";
import { groupMyTasks, myTasksGroupStartsOpen } from "@/lib/onboarding-work-views";
import { rowActionsFor } from "@/lib/plan-catch-up";

describe("My Tasks order and folding (Nov 22)", () => {
  it("lists Overdue, Today and This week first, then Later and No date", () => {
    const groups = groupMyTasks([], "due", "2026-11-23", () => "Home");
    expect(groups.map((g) => g.key)).toEqual(["overdue", "today", "week", "later", "nodate"]);
  });
  it("opens Overdue, Today and This week; folds Later and No date", () => {
    expect(["overdue", "today", "week"].map((k) => myTasksGroupStartsOpen("due", k))).toEqual([true, true, true]);
    expect(myTasksGroupStartsOpen("due", "later")).toBe(false);
    expect(myTasksGroupStartsOpen("due", "nodate")).toBe(false);
  });
  it("keeps home and role groups open", () => {
    expect(myTasksGroupStartsOpen("home", "home:Any")).toBe(true);
    expect(myTasksGroupStartsOpen("role", "role:Utilities")).toBe(true);
  });
});

describe("Task row actions are the home page's Mark done, Not needed and Change due date (Nov 22)", () => {
  it("an open Task offers all three", () => {
    expect(rowActionsFor({ status: "open" })).toEqual(["mark_done", "not_needed", "due_date"]);
  });
  it("a finished Task is not marked done again", () => {
    expect(rowActionsFor({ status: "complete" })).toEqual(["not_needed", "due_date"]);
  });
});
