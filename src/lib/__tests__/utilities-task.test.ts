/** Nov 21: utilities Tasks show Add utility for the right people and are grouped together on My Tasks. */
import { describe, expect, it } from "bun:test";
import { canEditHomeUtilities, showsUtilitiesPanel } from "../utilities-task";
import { groupMyTasksByRole } from "../onboarding-work-views";
import type { TaskView } from "../onboarding-workflow";

const HOME = "11111111-1111-4111-8111-111111111111";
const BOTH = "22222222-2222-4222-8222-222222222222";
const UTIL = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const project = (pm: string | null, util: string | null) => ({
  property_id: HOME, project_manager: pm, director: null, status: "active", utility_manager: util,
});

describe("Add utility inside a utilities Task", () => {
  it("opens for someone who is both the Project Manager and the Utilities person on the home", () => {
    expect(canEditHomeUtilities(BOTH, false, HOME, [project(BOTH, BOTH)])).toBe(true);
  });
  it("opens for the home's Utilities person who is not its Project Manager", () => {
    expect(canEditHomeUtilities(UTIL, false, HOME, [project(OTHER, UTIL)])).toBe(true);
  });
  it("stays closed for someone with neither role on the home", () => {
    expect(canEditHomeUtilities(OTHER, false, HOME, [project(BOTH, UTIL)])).toBe(false);
  });
  it("shows on every utilities Task, whatever its kind", () => {
    expect(showsUtilitiesPanel({ assigned_seat: "utilities" }, "do_it", [], false)).toBe(true);
    expect(showsUtilitiesPanel({ assigned_seat: "utilities" }, "upload_files", [], true)).toBe(true);
  });
  it("is not shown twice where the Fill in part already shows it", () => {
    expect(showsUtilitiesPanel({ assigned_seat: "utilities" }, "fill_in", ["wifi"], false)).toBe(false);
  });
  it("is not added to Tasks for other roles", () => {
    expect(showsUtilitiesPanel({ assigned_seat: "designer" }, "do_it", [], false)).toBe(false);
  });
});

describe("My Tasks grouped by role", () => {
  const view = (id: string, seat: string | null) => ({ task: { id, assigned_seat: seat } }) as unknown as TaskView;
  it("puts every utilities Task together in the first group", () => {
    const groups = groupMyTasksByRole([view("a", "onboarding_project_manager"), view("b", "utilities"), view("c", null), view("d", "utilities")]);
    expect(groups[0]!.label).toBe("Utilities");
    expect(groups[0]!.items.map((v) => v.task.id)).toEqual(["b", "d"]);
    expect(groups.at(-1)!.label).toBe("No role");
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(4);
  });
});
