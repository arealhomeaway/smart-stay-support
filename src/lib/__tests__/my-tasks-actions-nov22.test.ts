import { describe, expect, it } from "bun:test";
import { groupMyTasks, myTasksGroupStartsOpen } from "@/lib/onboarding-work-views";
import { rowActionsFor } from "@/lib/plan-catch-up";
import { reviewHistoryFor, splitOwnerCompletions } from "@/lib/owner-completion-review";

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

describe("Owner completions to review (Nov 22)", () => {
  const row = (id: string, review_status: "needs_review" | "follow_up_needed" | "reviewed", new_owner_activity = false) => ({
    id,
    review_status,
    new_owner_activity,
  });
  it("shows only completions not yet reviewed; reviewed ones go to Reviewed", () => {
    const { toReview, reviewed } = splitOwnerCompletions([row("a", "needs_review"), row("b", "reviewed"), row("c", "follow_up_needed")]);
    expect(toReview.map((r) => r.id)).toEqual(["a", "c"]);
    expect(reviewed.map((r) => r.id)).toEqual(["b"]);
  });
  it("a reviewed completion with a new owner answer comes back to review", () => {
    const { toReview, reviewed } = splitOwnerCompletions([row("b", "reviewed", true)]);
    expect(toReview.map((r) => r.id)).toEqual(["b"]);
    expect(reviewed).toEqual([]);
  });
  it("keeps every review of a completion, newest first", () => {
    const h = [
      { id: "1", work_item_id: "w", status: "follow_up_needed" as const, internal_note: null, created_at: "2026-11-01T10:00:00Z", actor_id: null },
      { id: "2", work_item_id: "w", status: "reviewed" as const, internal_note: "ok", created_at: "2026-11-03T10:00:00Z", actor_id: null },
      { id: "3", work_item_id: "x", status: "reviewed" as const, internal_note: null, created_at: "2026-11-02T10:00:00Z", actor_id: null },
    ];
    expect(reviewHistoryFor(h, "w").map((r) => r.id)).toEqual(["2", "1"]);
  });
});
