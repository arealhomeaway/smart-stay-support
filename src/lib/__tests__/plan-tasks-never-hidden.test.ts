/**
 * Onboarding fix (Admin, Nov 21): no project plan Task is ever hidden. Every Task shows for its
 * owner on My Tasks, on the home's Tasks tab and in its Whose Task row, whatever its due date,
 * stage or kind.
 */
import { describe, expect, it } from "bun:test";
import { ownerTagsFor, stageLists, tagCounts, type PageTask } from "../onboarding-home-page";
import { myWorkSelection } from "../onboarding-work-views";
import { homeRoleHolder, planTaskOwner } from "../plan-task-owner";

const PM = "pm";
const DESIGNER = "designer-person";
const UTIL = "utilities-person";
const TODAY = "2026-11-21";
let n = 0;
const t = (o: Partial<PageTask>): PageTask => ({
  id: `t${++n}`,
  title: "Task",
  stage: "Pre-Close",
  status: "open",
  due_on: null,
  assigned_to: null,
  ...o,
});

describe("one owner rule", () => {
  const team = { project_manager: PM, director: "dir", utility_manager: UTIL, role_assignments: { designer: DESIGNER } };
  it("named person first, then the home's role holder, then the home's PM", () => {
    expect(planTaskOwner({ assigned_to: "someone", assigned_seat: "utilities" }, team)).toBe("someone");
    expect(planTaskOwner({ assigned_to: null, assigned_seat: "utilities" }, team)).toBe(UTIL);
    expect(planTaskOwner({ assigned_to: null, assigned_seat: "designer" }, team)).toBe(DESIGNER);
    expect(planTaskOwner({ assigned_to: null, assigned_seat: "onboarding_director" }, team)).toBe("dir");
    expect(planTaskOwner({ assigned_to: null, assigned_seat: null }, team)).toBe(PM);
  });
  it("a role nobody holds on this home goes to the home's PM", () => {
    expect(homeRoleHolder({ project_manager: PM, utility_manager: null }, "utilities")).toBeNull();
    expect(planTaskOwner({ assigned_to: null, assigned_seat: "utilities" }, { project_manager: PM, utility_manager: null })).toBe(PM);
  });
});

describe("Whose Task on a home", () => {
  it("counts every stage, not only the picked one", () => {
    const tasks = [
      t({ stage: "Intake", assigned_to: PM }),
      t({ stage: "Pre-Close", assigned_to: PM }),
      t({ stage: "Handoff", assigned_to: PM, due_on: "2027-03-01" }),
      t({ stage: "Setup & Staging", assigned_to: PM }),
    ];
    expect(tagCounts(tasks, PM, PM).you).toBe(4);
  });
  it("Designer counts Designer Tasks the viewer owns", () => {
    const designerTask = t({ assigned_seat: "designer", assigned_to: DESIGNER });
    expect(ownerTagsFor(designerTask, DESIGNER, PM)).toEqual(["you", "designer"]);
    // A Designer Task with nobody named is the PM's, and still counts for Designer.
    const unnamed = t({ assigned_seat: "designer" });
    expect(tagCounts([designerTask, unnamed], PM, PM)).toMatchObject({ you: 1, designer: 2 });
    expect(tagCounts([designerTask, unnamed], DESIGNER, PM)).toMatchObject({ you: 1, designer: 2 });
  });
  it("Utilities lists the internet and Wi-Fi Tasks in every stage, dated or not", () => {
    const tasks = [
      t({ title: "Set up internet service", assigned_seat: "utilities", due_on: "2026-11-10" }),
      t({ title: "Update the Wi-Fi network name and password", stage: "Ordering & Repairs", assigned_seat: "utilities", task_kind: "fill_in" }),
      t({ title: "Other", assigned_to: "x", assigned_seat: "onboarding_director" }),
    ];
    const l = stageLists(tasks, { stage: null, today: TODAY, tag: "utilities", viewerId: PM, pmId: PM });
    const shown = [...l.doNow.map((x) => x.task.title), ...l.upNext.map((x) => x.title)];
    expect(shown.sort()).toEqual(["Set up internet service", "Update the Wi-Fi network name and password"]);
  });
});

describe("My Tasks", () => {
  const projects = [{ property_id: "fern", project_manager: PM, director: null, status: "active" }];
  it("shows the PM a role Task nobody on the home holds", () => {
    const tasks = [
      { id: "wifi", property_id: "fern", assigned_to: null, plan_owner: PM },
      { id: "theirs", property_id: "fern", assigned_to: "x", plan_owner: "x" },
    ];
    expect(myWorkSelection(tasks, PM, "me", false, projects).tasks.map((x) => x.id)).toEqual(["wifi"]);
  });
  it("shows a finished role Task to the person holding that role", () => {
    const tasks = [{ id: "done-internet", property_id: "other", assigned_to: null, status: "complete", plan_owner: UTIL }];
    expect(myWorkSelection(tasks, UTIL, "me", false, []).tasks.map((x) => x.id)).toEqual(["done-internet"]);
  });
});
