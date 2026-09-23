import { describe, expect, it } from "bun:test";
import { createOnboardingQaProject } from "../onboarding-qa-fixtures";
import { FULL_FURNISHING_TEMPLATE } from "../onboarding-template";
import { applyTestDataFilter } from "../test-data";
import { deriveLifecycle } from "../onboarding-state";

describe("canonical onboarding QA projects", () => {
  it("creates the full current template and subtasks for both scope cases", () => {
    const expected = FULL_FURNISHING_TEMPLATE.reduce(
      (count, task) => count + 1 + (task.subtasks?.length ?? 0),
      0,
    );
    for (const scope of ["full_furnishing", "no_furnishing"] as const) {
      const fixture = createOnboardingQaProject(scope);
      expect(fixture.allTasks.length).toBe(expected);
      expect(new Set(fixture.allTasks.map((task) => task.id)).size).toBe(expected);
      expect(
        fixture.allTasks.every((task) => task.is_demo && task.property_id === fixture.property.id),
      ).toBe(true);
      expect(fixture.project.is_demo).toBe(true);
    }
  });
  it("excludes both homes from standard reporting and keeps data independent", () => {
    const full = createOnboardingQaProject("full_furnishing");
    const existing = createOnboardingQaProject("no_furnishing");
    expect(applyTestDataFilter([full, existing], false, (fixture) => fixture.property).length).toBe(
      0,
    );
    full.allTasks[0]!.status = "complete";
    expect(createOnboardingQaProject("full_furnishing").allTasks[0]!.status).toBe("open");
    expect(existing.allTasks[0]!.status).toBe("open");
  });
  it.skip("inherits exclusions for furnishing subtasks while retaining guest-readiness work", () => {
    const fixture = createOnboardingQaProject("no_furnishing");
    const excluded = new Set(fixture.outOfScope.map(({ task }) => task.id));
    expect(fixture.outOfScope.length > 0).toBe(true);
    expect(fixture.inScope.some((task) => /utility|utilities/i.test(task.title))).toBe(true);
    expect(
      fixture.inScope.every((task) => !task.parent_task_id || !excluded.has(task.parent_task_id)),
    ).toBe(true);
  });
  it("keeps Operations acceptance distinct from Supervisor Live in both projects", () => {
    for (const scope of ["full_furnishing", "no_furnishing"] as const) {
      expect(deriveLifecycle(createOnboardingQaProject(scope, "pre_close").state).phase).toBe(
        "pre_close",
      );
      expect(deriveLifecycle(createOnboardingQaProject(scope, "pending_live").state).phase).toBe(
        "live_confirmation",
      );
      expect(deriveLifecycle(createOnboardingQaProject(scope, "live").state).live).toBe(true);
    }
  });
});
