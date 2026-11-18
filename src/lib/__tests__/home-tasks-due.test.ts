import { describe, expect, it } from "bun:test";
import {
  dueChipLabel,
  dueCounts,
  matchesDueFilters,
  stageLists,
  toggleDueFilter,
  type PageTask,
} from "@/lib/onboarding-home-page";

// 2026-11-05 is a Thursday; this week is Nov 2 to Nov 8, next week Nov 9 to Nov 15. Nov 1 is the Sunday before.
const TODAY = "2026-11-05";

function task(id: string, due: string | null, extra: Partial<PageTask> = {}): PageTask {
  return { id, title: `Task ${id}`, stage: "Onboarding", status: "not_started", due_on: due, assigned_to: null, ...extra };
}

describe("matchesDueFilters", () => {
  it("Overdue is open and due before today, the same rule as the red date", () => {
    expect(matchesDueFilters(task("1", "2026-11-04"), ["overdue"], TODAY)).toBe(true);
    expect(matchesDueFilters(task("2", TODAY), ["overdue"], TODAY)).toBe(false);
    expect(matchesDueFilters(task("3", null), ["overdue"], TODAY)).toBe(false);
  });

  it("Due today, Due this week and Due next week use Monday to Sunday weeks", () => {
    expect(matchesDueFilters(task("1", TODAY), ["due_today"], TODAY)).toBe(true);
    expect(matchesDueFilters(task("2", "2026-11-02"), ["this_week"], TODAY)).toBe(true);
    expect(matchesDueFilters(task("3", "2026-11-08"), ["this_week"], TODAY)).toBe(true);
    expect(matchesDueFilters(task("4", "2026-11-09"), ["this_week"], TODAY)).toBe(false);
    expect(matchesDueFilters(task("5", "2026-11-09"), ["next_week"], TODAY)).toBe(true);
    expect(matchesDueFilters(task("6", "2026-11-15"), ["next_week"], TODAY)).toBe(true);
    expect(matchesDueFilters(task("7", "2026-11-16"), ["next_week"], TODAY)).toBe(false);
  });

  it("matches ANY button that is on", () => {
    const filters = ["overdue", "due_today"] as const;
    expect(matchesDueFilters(task("1", "2026-11-01"), filters, TODAY)).toBe(true);
    expect(matchesDueFilters(task("2", TODAY), filters, TODAY)).toBe(true);
    expect(matchesDueFilters(task("3", "2026-11-07"), filters, TODAY)).toBe(false);
  });

  it("never matches finished Tasks or sub-Tasks", () => {
    expect(matchesDueFilters(task("1", "2026-11-01", { status: "complete" }), ["overdue"], TODAY)).toBe(false);
    expect(matchesDueFilters(task("2", TODAY, { parent_task_id: "1" }), ["due_today"], TODAY)).toBe(false);
  });

  it("with no button on, nothing is narrowed", () => {
    expect(matchesDueFilters(task("1", null), [], TODAY)).toBe(true);
  });
});

describe("Due buttons on the Tasks tab", () => {
  const tasks = [
    task("late", "2026-11-01"),
    task("today", TODAY),
    task("next", "2026-11-12"),
    task("sub", TODAY, { parent_task_id: "late" }),
    task("done", "2026-11-01", { status: "complete", completed_at: "2026-11-01T10:00:00Z" }),
    task("other", "2026-11-01", { stage: "Design" }),
  ];

  it("counts open Tasks per button", () => {
    expect(dueCounts(tasks, TODAY)).toEqual({ overdue: 2, due_today: 1, this_week: 1, next_week: 1 });
  });

  it("Do now and Up next keep only matching Tasks and Done is hidden", () => {
    const base = { stage: null, today: TODAY, tag: null, viewerId: null, pmId: null };
    const off = stageLists(tasks, base);
    expect(off.done.map((t) => t.id)).toEqual(["done"]);
    const on = stageLists(tasks, { ...base, due: ["overdue", "next_week"] });
    expect(on.doNow.map((x) => x.task.id).sort()).toEqual(["late", "other"]);
    expect(on.upNext.map((t) => t.id)).toEqual(["next"]);
    expect(on.done).toEqual([]);
  });

  it("toggles in button order and writes the chip", () => {
    expect(toggleDueFilter(["due_today"], "overdue")).toEqual(["overdue", "due_today"]);
    expect(toggleDueFilter(["overdue", "due_today"], "overdue")).toEqual(["due_today"]);
    expect(dueChipLabel(["due_today", "overdue"])).toBe("Showing: Overdue or Due today");
  });
});
