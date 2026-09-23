import { describe, expect, it } from "bun:test";
import {
  groupMyWork,
  isWaitingTask,
  matchesWorkFilter,
  matchesPropertyQueueFilter,
  orderPropertyWorkQueue,
  parseWorkspaceSearch,
  workspaceSearchFromLens,
} from "../onboarding-work-views";
import type { TaskView } from "../onboarding-workflow";

function view(
  id: string,
  status: TaskView["status"],
  due: string | null = "2026-09-14",
  overdue = false,
): TaskView {
  return { status, overdue, task: { id, due_on: due } } as TaskView;
}
describe("work attention views", () => {
  it("places each open task once, keeping future and waiting work out of due today", () => {
    const groups = groupMyWork(
      [
        view("future", "future"),
        view("waiting", "blocked"),
        view("review", "needs_review"),
        view("correction", "correction"),
        view("today", "ready"),
        view("late", "ready", "2026-09-01", true),
      ],
      "2026-09-14",
    );
    expect(groups.flatMap((group) => group.items).length).toBe(6);
    expect(
      groups.find((group) => group.key === "today")!.items.map((item) => item.task.id),
    ).toEqual(["today"]);
    expect(groups.find((group) => group.key === "future")!.items[0]!.task.id).toBe("future");
    expect(groups.find((group) => group.key === "correction")!.items[0]!.task.id).toBe(
      "correction",
    );
  });
  it("finds completed work whose stage still needs review or correction", () => {
    expect(matchesWorkFilter(view("done", "complete"), "review", "awaiting_review")).toBe(true);
    expect(matchesWorkFilter(view("done", "complete"), "corrections", "correction_required")).toBe(
      true,
    );
    expect(matchesWorkFilter(view("future", "future"), "attention")).toBe(false);
  });
  it("routes gate reviews to handoff and other queues to their matching work filter", () => {
    expect(workspaceSearchFromLens("mine", true)).toEqual({ tab: "handoff", workFilter: "all" });
    expect(workspaceSearchFromLens("review", false)).toEqual({
      tab: "work",
      workFilter: "review",
    });
    expect(workspaceSearchFromLens("corrections", false)).toEqual({
      tab: "work",
      workFilter: "corrections",
    });
  });
  it("preserves navigation origin and supports old links after workspace consolidation", () => {
    expect(parseWorkspaceSearch({ tab: "files", from: "saved-hub", workFilter: "review" })).toEqual(
      { tab: "files", from: "saved-hub", workFilter: "review" },
    );
    expect(parseWorkspaceSearch({ tab: "calendar", workFilter: "invalid" })).toEqual({
      tab: "work",
      workFilter: "all",
    });
  });
  it("orders one property queue with workable steps before waiting and finished work", () => {
    const ready = view("ready", "ready", "2026-09-16");
    const overdue = view("overdue", "in_progress", "2026-09-10", true);
    const waiting = view("waiting", "blocked", "2026-09-12");
    const done = view("done", "complete", "2026-09-01");
    expect(orderPropertyWorkQueue([done, waiting, ready, overdue]).map((item) => item.task.id)).toEqual([
      "overdue",
      "ready",
      "waiting",
      "done",
    ]);
  });
  it("uses one filter model for attention, assignment and waiting", () => {
    const assigned = view("assigned", "ready");
    assigned.task.assigned_to = "viewer";
    const owner = view("owner", "needs_review");
    owner.task.owner_approval_status = "awaiting_owner";
    expect(matchesPropertyQueueFilter(assigned, "mine", "viewer")).toBe(true);
    expect(matchesPropertyQueueFilter(assigned, "waiting", "viewer")).toBe(false);
    expect(matchesPropertyQueueFilter(owner, "waiting", "viewer")).toBe(true);
    expect(isWaitingTask(owner)).toBe(true);
  });
});
