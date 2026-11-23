import { describe, expect, it } from "bun:test";
import { matchesTaskSearch, matchesTaskTypes, taskTypeOf } from "@/lib/onboarding-task-search";
import { parseMyTasksPrefs } from "@/lib/onboarding-work-views";
import {
  activeFilterCount,
  boardHome,
  clearedFilters,
  kanbanColumns,
  openSettings,
  parseViewSettings,
  settingsOf,
} from "@/lib/my-tasks-saved-views";
import { columnLayout, columnsToSave, moveColumn, pickColumnLayout, toggleColumn, DEFAULT_HOME_COLUMNS } from "@/lib/onboarding-home";
import type { TaskView } from "@/lib/onboarding-workflow";

const H1 = "11111111-1111-1111-1111-111111111111";
const H2 = "22222222-2222-2222-2222-222222222222";

const task = { title: "Set up internet", description: "Call the provider", task_kind: "fill_in", assigned_seat: "utilities", tags: ["active_owner"] };

describe("search matches task text, type, role and tag", () => {
  it("matches the task text", () => expect(matchesTaskSearch(task, "internet")).toBe(true));
  it("matches the task type", () => expect(matchesTaskSearch(task, "fill in")).toBe(true));
  it("matches the assignee role", () => expect(matchesTaskSearch(task, "utilities")).toBe(true));
  it("matches a tag", () => expect(matchesTaskSearch(task, "active owner")).toBe(true));
  it("needs every word typed", () => expect(matchesTaskSearch(task, "internet designer")).toBe(false));
  it("blank search matches everything", () => expect(matchesTaskSearch(task, "  ")).toBe(true));
});

describe("task type filter", () => {
  it("Utilities and Designer come from the role", () => {
    expect(taskTypeOf({ assigned_seat: "utilities" })).toBe("utilities");
    expect(taskTypeOf({ assigned_seat: "designer" })).toBe("designer");
  });
  it("homeowner tasks are Homeowner", () => expect(taskTypeOf({ task_kind: "send_to_owner", assigned_seat: "onboarding_project_manager" })).toBe("homeowner"));
  it("no type picked shows every task", () => expect(matchesTaskTypes({ assigned_seat: "designer" }, [])).toBe(true));
  it("picking Utilities hides a Designer task", () => expect(matchesTaskTypes({ assigned_seat: "designer" }, ["utilities"])).toBe(false));
});

describe("saved views keep filters, grouping and sort", () => {
  const prefs = { ...parseMyTasksPrefs({}), group: "home" as const, sort: "home" as const, types: ["utilities" as const], layout: "board" as const, board: H1 };
  const address = { who: "all", program: "active_owner", home: H2, state: "all", q: "internet" };
  it("a saved view opens exactly as saved", () => {
    const opened = openSettings(parseViewSettings(JSON.parse(JSON.stringify(settingsOf(address, prefs)))));
    expect(opened.address).toEqual(address);
    expect(opened.prefs.group).toBe("home");
    expect(opened.prefs.sort).toBe("home");
    expect(opened.prefs.types).toEqual(["utilities"]);
    expect(opened.prefs.layout).toBe("board");
  });
  it("Group by home is kept in the remembered choices", () => expect(parseMyTasksPrefs({ group: "home" }).group).toBe("home"));
  it("unknown stored values fall back", () => {
    const v = parseViewSettings({ who: "x", home: "nope", types: ["bogus"], layout: "grid" });
    expect(v.who).toBe("me");
    expect(v.home).toBe("all");
    expect(v.types).toEqual([]);
    expect(v.layout).toBe("list");
  });
  it("Clear filters keeps grouping and sort", () => {
    const c = clearedFilters(prefs);
    expect(c.prefs.group).toBe("home");
    expect(c.prefs.types).toEqual([]);
    expect(activeFilterCount(c.address, c.prefs, true)).toBe(0);
  });
  it("Filter count counts each choice", () => expect(activeFilterCount(address, prefs, true)).toBe(4));
});

describe("Kanban for one home", () => {
  const v = (id: string, property_id: string, status: TaskView["status"]) => ({ task: { id, property_id }, status }) as unknown as TaskView;
  const views = [v("a", H1, "ready"), v("b", H1, "in_progress"), v("c", H1, "blocked"), v("d", H1, "complete"), v("e", H2, "ready")];
  it("shows only the picked home in four columns", () => {
    const cols = kanbanColumns(views, H1);
    expect(cols.map((c) => c.label)).toEqual(["To do", "In progress", "Waiting", "Done"]);
    expect(cols.map((c) => c.items.map((i) => i.task.id))).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });
  it("picked home wins, else the filter home, else the first", () => {
    expect(boardHome(H2, "all", [H1, H2])).toBe(H2);
    expect(boardHome("", H2, [H1, H2])).toBe(H2);
    expect(boardHome("", "all", [H1, H2])).toBe(H1);
    expect(boardHome(H1, "all", [])).toBeNull();
  });
});

describe("Project Database columns per person", () => {
  it("includes the Stager / on-site team column by default", () => expect(DEFAULT_HOME_COLUMNS).toContain("stager"));
  it("an older saved list keeps the standard columns and adds its extras", () => expect(columnLayout(["owner"])).toEqual([...DEFAULT_HOME_COLUMNS, "owner"]));
  it("hidden and reordered columns read back the same", () => {
    const shown = moveColumn(toggleColumn(DEFAULT_HOME_COLUMNS, "schedule"), "stager", "status");
    expect(shown).toEqual(["stager", "status", "dates", "team"]);
    expect(columnLayout(columnsToSave(shown))).toEqual(shown);
  });
  it("a saved new-form list wins over the browser copy", () => expect(pickColumnLayout(["home", "team"], ["home", "status"])).toEqual(["team"]));
  it("before apply the browser copy is used", () => expect(pickColumnLayout(["owner"], ["home", "status"])).toEqual(["status"]));
});
