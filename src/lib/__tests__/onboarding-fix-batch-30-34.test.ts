import { describe, expect, it } from "vitest";
import { searchPlanTasks, OTHER_STAGE_LABEL } from "@/lib/plan-search";
import { onboardingTaskHref, onboardingTaskVisibility, taskTitleMatches } from "@/lib/onboarding-search";
import { validateMyWorkSearch } from "@/lib/onboarding-work-views";
import { CONNECTION_LABEL, breezewayConnection } from "@/lib/onboarding-breezeway";
import {
  UNASSIGNED_VALUE,
  breezewayPersonOptions,
  breezewayTemplateOptions,
  filterPickerOptions,
} from "@/lib/searchable-picker";
import { SIX_STAGES } from "@/lib/onboarding-board";

describe("item 30: Plan search", () => {
  const tasks = [
    { id: "1", title: "Order the welcome book", stage: "Ordering & Repairs", status: "open" },
    { id: "2", title: "Photograph the home", stage: "Setup & Staging", status: "complete" },
    { id: "3", title: "Order photos frames", stage: "unknown-stage", status: "complete" },
    { id: "4", title: "Schedule the cleaner", stage: "Intake", status: "open" },
  ];

  it("a blank search returns null so the normal list shows", () => {
    expect(searchPlanTasks(tasks, "")).toBeNull();
    expect(searchPlanTasks(tasks, "   ")).toBeNull();
  });

  it("filters by any part of the title, case ignored, finished Tasks included", () => {
    const hits = searchPlanTasks(tasks, "PHOTO")!;
    expect(hits.map((h) => h.task.id).sort()).toEqual(["2", "3"]);
    expect(hits.some((h) => h.task.status === "complete")).toBe(true);
  });

  it("each result names its stage; a Task outside the six stages says Other tasks", () => {
    const hits = searchPlanTasks(tasks, "order")!;
    const other = hits.find((h) => h.task.id === "3")!;
    expect(other.stage).toBe(OTHER_STAGE_LABEL);
    for (const h of hits) expect([...SIX_STAGES, OTHER_STAGE_LABEL]).toContain(h.stage);
  });

  it("matches across every stage, not only the current one, listed in stage order", () => {
    const hits = searchPlanTasks(tasks, "the")!;
    expect(hits.map((h) => h.task.id)).toEqual(["4", "1", "2"]);
    expect(hits.map((h) => h.stage)).toEqual(["Intake", "Ordering & Repairs", "Setup & Staging"]);
  });
});

describe("item 30: Search Resolve finds onboarding Tasks", () => {
  const task = { id: "t1", title: "Work order: Final inspection", property_id: "p1", assigned_to: "u2" };
  it("matches the title by any part", () => {
    expect(taskTitleMatches(task.title, "final")).toBe(true);
    expect(taskTitleMatches(task.title, "staging")).toBe(false);
    expect(taskTitleMatches(task.title, "")).toBe(false);
  });
  it("leaders see every home; a Project Manager only their homes; others only Tasks assigned to them", () => {
    expect(onboardingTaskVisibility("portfolio", "u9", new Set(), task)).toBe("home");
    expect(onboardingTaskVisibility("projects", "u1", new Set(["p1"]), task)).toBe("home");
    expect(onboardingTaskVisibility("projects", "u1", new Set(["p2"]), task)).toBeNull();
    expect(onboardingTaskVisibility("assigned", "u2", new Set(), task)).toBe("my_work");
    expect(onboardingTaskVisibility("assigned", "u3", new Set(), task)).toBeNull();
  });
  it("opens the Task drawer on the home's Plan tab, or in My Tasks", () => {
    expect(onboardingTaskHref({ id: "t1", propertyId: "p1", opensIn: "home" })).toBe("/onboarding/p1?tab=plan&task=t1");
    expect(onboardingTaskHref({ id: "t1", propertyId: "p1", opensIn: "my_work" })).toBe("/onboarding/my-work?who=me&task=t1");
  });
  it("My Tasks keeps a Task id from the link so its drawer opens", () => {
    const id = "a0000000-0000-4000-8000-00000000a001";
    expect(validateMyWorkSearch({ who: "me", task: id } as never).task).toBe(id);
    expect("task" in validateMyWorkSearch({ who: "me", task: "nope" } as never)).toBe(false);
  });
});

describe("item 33: Breezeway section wording and Assign to default", () => {
  it("the chip reads Not sent yet before sending", () => {
    expect(CONNECTION_LABEL[breezewayConnection({ breezewayTaskId: null, mirrored: false })]).toBe("Not sent yet");
  });
  it("Unassigned is a choice, listed first", () => {
    const options = breezewayPersonOptions([{ id: 7, name: "Zed Ortiz" }, { id: 3, name: "Ana Cruz" }]);
    expect(options[0]).toEqual({ value: UNASSIGNED_VALUE, label: "Unassigned", detail: null });
    expect(options.map((o) => o.label)).toEqual(["Unassigned", "Ana Cruz", "Zed Ortiz"]);
  });
});

describe("item 34: searchable pickers", () => {
  const templates = breezewayTemplateOptions([
    { id: 11, name: "New House Setup - Final Inspection", department: "inspection" },
    { id: 12, name: "Deep Clean", department: "housekeeping" },
    { id: 13, name: "Deep Clean", department: "maintenance" },
    { id: 14, name: "Hot tub service", department: null },
  ]);
  it('typing "final" shows "New House Setup - Final Inspection"', () => {
    expect(filterPickerOptions(templates, "final").map((o) => o.label)).toEqual(["New House Setup - Final Inspection"]);
  });
  it("matches any part of the name, case and spacing ignored", () => {
    expect(filterPickerOptions(templates, "  TUB  ").map((o) => o.value)).toEqual(["14"]);
    expect(filterPickerOptions(templates, "clean").map((o) => o.value)).toEqual(["12", "13"]);
    expect(filterPickerOptions(templates, "")).toHaveLength(4);
  });
  it("two templates with the same name show department and template number; unique names show nothing extra", () => {
    const byId = Object.fromEntries(templates.map((t) => [t.value, t.detail]));
    expect(byId["12"]).toBe("Housekeeping · Template 12");
    expect(byId["13"]).toBe("Maintenance · Template 13");
    expect(byId["11"]).toBeNull();
    expect(byId["14"]).toBeNull();
  });
  it("Assign to filters people by any part of the name; same-named people show their number", () => {
    const people = breezewayPersonOptions([
      { id: 1, name: "Maria Lopez" },
      { id: 2, name: "Maria Lopez" },
      { id: 3, name: "Luis Gomez" },
    ]);
    expect(filterPickerOptions(people, "lop").map((o) => o.value)).toEqual(["1", "2"]);
    expect(people.filter((p) => p.label === "Maria Lopez").map((p) => p.detail)).toEqual(["Person 1", "Person 2"]);
    expect(people.find((p) => p.value === "3")!.detail).toBeNull();
  });
});
