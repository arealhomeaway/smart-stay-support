/**
 * A home's dates must read the same on every page: saving them from the
 * dashboard writes the home AND the onboarding project, so the scope card can
 * never show an older copy of the same date.
 */
import { describe, expect, it, mock } from "bun:test";

// Module mocks are global to the test run, so every stub here stays opt-in and
// is switched back off once this file finishes — other suites keep the real code.
let stubbed = true;
const releaseStubs = () => {
  stubbed = false;
};

mock.module("@/lib/audit.server", () => ({ writeAudit: async () => {} }));
mock.module("../audit.server", () => ({ writeAudit: async () => {} }));
const realAccess = await import("../onboarding-task-access.server");
mock.module("../onboarding-task-access.server", () => ({
  ...realAccess,
  assertOnboardingPropertyManagement: async (...args: unknown[]) =>
    stubbed
      ? undefined
      : (realAccess.assertOnboardingPropertyManagement as (...a: unknown[]) => unknown)(...args),
}));
const realSchedule = await import("../onboarding-schedule.server");
const stubOr =
  (name: keyof typeof realSchedule, value: unknown) =>
  async (...args: unknown[]) =>
    stubbed ? value : (realSchedule[name] as (...a: unknown[]) => unknown)(...args);
mock.module("../onboarding-schedule.server", () => ({
  ...realSchedule,
  previewScheduleRecalc: stubOr("previewScheduleRecalc", { rows: [] }),
  applyScheduleRecalc: stubOr("applyScheduleRecalc", { applied: 0 }),
  autopopulateProjectDeadlines: stubOr("autopopulateProjectDeadlines", { applied: 0 }),
}));

const { saveOnboardingMilestones } = await import("../onboarding-milestones.server");

function fixture() {
  const writes: { table: string; patch: Record<string, unknown> }[] = [];
  const db = {
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        order: () => query,
        limit: async () => ({
          data: [
            {
              id: "project-1",
              modules: [],
              target_handoff_on: null,
              target_handoff_source: "auto",
              planned_closing_on: null,
              possession_on: null,
            },
          ],
          error: null,
        }),
        single: async () => ({
          data: { planned_closing_on: null, actual_closing_on: null, actual_access_on: null },
          error: null,
        }),
        maybeSingle: async () => ({ data: { id: "home-1" }, error: null }),
        update: (patch: Record<string, unknown>) => {
          writes.push({ table, patch });
          return query;
        },
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return query;
    },
  };
  return { db, writes };
}

describe("onboarding milestone sync", () => {
  it("writes the same closing and access dates to the home and the project", async () => {
    const f = fixture();
    await saveOnboardingMilestones(f.db as never, "staff", {
      propertyId: "home-1",
      plannedClosingOn: "2026-09-20",
      actualClosingOn: "2026-09-24",
      actualAccessOn: "2026-09-22",
    });
    const home = f.writes.find((w) => w.table === "properties")!;
    const project = f.writes.find((w) => w.table === "onboarding_projects")!;
    expect(home.patch["actual_closing_on"]).toBe("2026-09-24");
    expect(home.patch["actual_access_on"]).toBe("2026-09-22");
    expect(project.patch["planned_closing_on"]).toBe("2026-09-24");
    expect(project.patch["possession_on"]).toBe("2026-09-22");
    releaseStubs();
  });
});
