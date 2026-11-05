import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/onboarding-workflow";
import {
  MY_TASKS_PREFS_DEFAULTS,
  groupMyTasks,
  loadMyTasksPrefs,
  matchesMyTasksDueRange,
  matchesMyTasksQuick,
  myTasksPrefsKey,
  myTasksWeeks,
  saveMyTasksPrefs,
  sortMyTasks,
} from "@/lib/onboarding-work-views";

function view(
  id: string,
  due: string | null,
  status: string = "ready",
  propertyId = "home-a",
  overdue = false,
): TaskView {
  return {
    task: {
      id,
      title: `Task ${id}`,
      property_id: propertyId,
      due_on: due,
      sort_order: Number(id) || 0,
      status: status === "complete" ? "complete" : "open",
    },
    status,
    overdue,
  } as unknown as TaskView;
}

const HOME_NAMES: Record<string, string> = {
  "home-a": "100 Alpha St",
  "home-b": "200 Beta Ave",
  "home-c": "300 Cedar Ct",
};
const homeName = (id: string) => HOME_NAMES[id] ?? "Unknown home";

// 2026-11-05 is a Thursday; its Monday-start week is Nov 2 to Nov 8.
const TODAY = "2026-11-05";

describe("myTasksWeeks", () => {
  it("bounds this week and next week on Mondays", () => {
    expect(myTasksWeeks(TODAY)).toEqual({
      thisStart: "2026-11-02",
      thisEnd: "2026-11-08",
      nextStart: "2026-11-09",
      nextEnd: "2026-11-15",
    });
  });

  it("treats a Monday as the start of its own week", () => {
    expect(myTasksWeeks("2026-11-09").thisStart).toBe("2026-11-09");
  });
});

describe("matchesMyTasksQuick", () => {
  it("incomplete shows open work and hides completed", () => {
    expect(matchesMyTasksQuick(view("1", TODAY), "incomplete", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("2", TODAY, "complete"), "incomplete", TODAY)).toBe(false);
  });

  it("completed shows only finished work", () => {
    expect(matchesMyTasksQuick(view("1", TODAY, "complete"), "completed", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("2", TODAY, "carryover"), "completed", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("3", TODAY), "completed", TODAY)).toBe(false);
  });

  it("due today matches only today's date on open work", () => {
    expect(matchesMyTasksQuick(view("1", TODAY), "due_today", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("2", "2026-11-06"), "due_today", TODAY)).toBe(false);
    expect(matchesMyTasksQuick(view("3", TODAY, "complete"), "due_today", TODAY)).toBe(false);
  });

  it("overdue matches past dates and the overdue flag", () => {
    expect(matchesMyTasksQuick(view("1", "2026-11-04"), "overdue", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("2", null, "ready", "home-a", true), "overdue", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("3", TODAY), "overdue", TODAY)).toBe(false);
  });

  it("this week and next week use the Monday bounds", () => {
    expect(matchesMyTasksQuick(view("1", "2026-11-02"), "this_week", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("2", "2026-11-08"), "this_week", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("3", "2026-11-09"), "this_week", TODAY)).toBe(false);
    expect(matchesMyTasksQuick(view("4", "2026-11-09"), "next_week", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("5", "2026-11-15"), "next_week", TODAY)).toBe(true);
    expect(matchesMyTasksQuick(view("6", "2026-11-16"), "next_week", TODAY)).toBe(false);
    expect(matchesMyTasksQuick(view("7", null), "this_week", TODAY)).toBe(false);
  });
});

describe("matchesMyTasksDueRange", () => {
  it("passes everything when no range is set", () => {
    expect(matchesMyTasksDueRange(view("1", null), "", "")).toBe(true);
  });

  it("keeps only dates inside the range and drops undated work", () => {
    expect(matchesMyTasksDueRange(view("1", "2026-11-10"), "2026-11-09", "2026-11-15")).toBe(true);
    expect(matchesMyTasksDueRange(view("2", "2026-11-08"), "2026-11-09", "")).toBe(false);
    expect(matchesMyTasksDueRange(view("3", "2026-11-20"), "", "2026-11-15")).toBe(false);
    expect(matchesMyTasksDueRange(view("4", null), "2026-11-09", "")).toBe(false);
  });
});

describe("sortMyTasks", () => {
  it("sorts by due date oldest first with undated last", () => {
    const sorted = sortMyTasks(
      [view("1", null), view("2", "2026-11-09"), view("3", "2026-11-04")],
      "due",
      homeName,
    );
    expect(sorted.map((v) => v.task.id)).toEqual(["3", "2", "1"]);
  });

  it("sorts by home name, then due date inside a home", () => {
    const sorted = sortMyTasks(
      [
        view("1", "2026-11-06", "ready", "home-c"),
        view("2", "2026-11-09", "ready", "home-a"),
        view("3", "2026-11-04", "ready", "home-a"),
      ],
      "home",
      homeName,
    );
    expect(sorted.map((v) => v.task.id)).toEqual(["3", "2", "1"]);
  });
});

describe("groupMyTasks", () => {
  it("groups by due date into Overdue, Today, This week, Later, No date", () => {
    const groups = groupMyTasks(
      [
        view("1", "2026-11-01"),
        view("2", TODAY),
        view("3", "2026-11-07"),
        view("4", "2026-11-20"),
        view("5", null),
      ],
      "due",
      TODAY,
      homeName,
    );
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.items.map((v) => v.task.id)]));
    expect(byKey.overdue).toEqual(["1"]);
    expect(byKey.today).toEqual(["2"]);
    expect(byKey.week).toEqual(["3"]);
    expect(byKey.later).toEqual(["4"]);
    expect(byKey.nodate).toEqual(["5"]);
  });

  it("groups by home in name order", () => {
    const groups = groupMyTasks(
      [view("1", TODAY, "ready", "home-c"), view("2", TODAY, "ready", "home-a")],
      "home",
      TODAY,
      homeName,
    );
    expect(groups.map((g) => g.label)).toEqual(["100 Alpha St", "300 Cedar Ct"]);
  });
});

describe("My Tasks saved view", () => {
  function fakeStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
  }

  it("remembers each person's last choice under their own key", () => {
    const storage = fakeStorage();
    saveMyTasksPrefs(storage, "user-1", { ...MY_TASKS_PREFS_DEFAULTS, quick: "overdue", group: "home" });
    saveMyTasksPrefs(storage, "user-2", { ...MY_TASKS_PREFS_DEFAULTS, quick: "due_today" });
    expect(loadMyTasksPrefs(storage, "user-1").quick).toBe("overdue");
    expect(loadMyTasksPrefs(storage, "user-1").group).toBe("home");
    expect(loadMyTasksPrefs(storage, "user-2").quick).toBe("due_today");
    expect(myTasksPrefsKey("user-1")).not.toBe(myTasksPrefsKey("user-2"));
  });

  it("falls back to defaults for a missing or corrupt saved view", () => {
    const storage = fakeStorage();
    expect(loadMyTasksPrefs(storage, "user-1")).toEqual(MY_TASKS_PREFS_DEFAULTS);
    storage.setItem(myTasksPrefsKey("user-1"), "not json");
    expect(loadMyTasksPrefs(storage, "user-1")).toEqual(MY_TASKS_PREFS_DEFAULTS);
    storage.setItem(myTasksPrefsKey("user-1"), JSON.stringify({ quick: "nonsense", sort: "sideways" }));
    expect(loadMyTasksPrefs(storage, "user-1")).toEqual(MY_TASKS_PREFS_DEFAULTS);
  });

  it("keeps a valid saved date range", () => {
    const storage = fakeStorage();
    saveMyTasksPrefs(storage, "user-1", { ...MY_TASKS_PREFS_DEFAULTS, from: "2026-11-09", to: "2026-11-15" });
    const loaded = loadMyTasksPrefs(storage, "user-1");
    expect(loaded.from).toBe("2026-11-09");
    expect(loaded.to).toBe("2026-11-15");
  });
});
