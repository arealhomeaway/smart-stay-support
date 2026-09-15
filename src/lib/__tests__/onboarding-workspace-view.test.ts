import { expect, it } from "bun:test";
import { onboardingWorkspaceMode, onboardingWorkspaceKey } from "../onboarding-workspace-view";

it("uses existing supervisor capability for the portfolio and project assignment for the lead view", () => {
  const project = { project_manager: "pm", director: "director", status: "active" };
  expect(onboardingWorkspaceMode("supervisor", true, [])).toBe("portfolio");
  expect(onboardingWorkspaceMode("pm", false, [project])).toBe("projects");
  expect(onboardingWorkspaceMode("director", false, [project])).toBe("projects");
  expect(onboardingWorkspaceMode("field", false, [project])).toBe("assigned");
  expect(onboardingWorkspaceMode("pm", false, [{ ...project, status: "cancelled" }])).toBe(
    "assigned",
  );
});

it("separates onboarding query caches across signed-in identities", () => {
  expect(onboardingWorkspaceKey("staff-a")).toEqual(["onboarding-workspace", "staff-a"]);
  expect(onboardingWorkspaceKey("staff-b")).toEqual(["onboarding-workspace", "staff-b"]);
  expect(onboardingWorkspaceKey(null)).toEqual(["onboarding-workspace", null]);
});
