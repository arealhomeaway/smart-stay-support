import { expect, it } from "bun:test";
import { myWorkSelection } from "../onboarding-work-views";

const tasks = [
  { id: "mine", assigned_to: "field", property_id: "a" },
  { id: "team-a", assigned_to: "teammate", property_id: "a" },
  { id: "team-b", assigned_to: "teammate", property_id: "b" },
];
const projects = [{ property_id: "a", project_manager: "lead", director: null, status: "active" }];
it("keeps field staff on their own work even with another assignee in the URL", () => {
  const view = myWorkSelection(tasks, "field", "teammate", false, projects);
  expect(view.canBrowseTeam).toBe(false);
  expect(view.tasks.map((task) => task.id)).toEqual(["mine"]);
});
it("limits a project lead's team view to projects they lead", () => {
  expect(
    myWorkSelection(tasks, "lead", "teammate", false, projects).tasks.map((task) => task.id),
  ).toEqual(["team-a"]);
  expect(
    myWorkSelection(tasks, "lead", "teammate", false, [{ ...projects[0]!, status: "cancelled" }])
      .canBrowseTeam,
  ).toBe(false);
});
it("supports supervisor team review and never treats a missing identity as unassigned", () => {
  expect(myWorkSelection(tasks, "supervisor", "teammate", true, projects).tasks.length).toBe(2);
  expect(
    myWorkSelection([{ assigned_to: null, property_id: "a" }], null, "me", false, projects).tasks
      .length,
  ).toBe(0);
});
