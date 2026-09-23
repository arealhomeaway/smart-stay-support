import { expect, it } from "bun:test";
import { matchesOnboardingLens, type HubViewer, type Lens } from "../onboarding-hub";
import { summarizeProject } from "../onboarding-lifecycle";
import { workspaceSearchFromLens } from "../onboarding-work-views";

const viewer = (gate: string): HubViewer => ({
  userId: "staff",
  reviewCapabilities: {
    is_admin: false,
    can_review_stages: gate === "director",
    kati_review: gate === "director",
    micah_review: gate === "readiness",
    operations_acceptance: gate === "acceptance",
    live_confirmation: gate === "live",
  },
});
const summary = () =>
  summarizeProject(
    {
      property: {
        id: "home",
        name: "Home",
        lifecycle_status: "onboarding",
        onboarding_stage: null,
        onboarding_owner: "legacy-pm",
        actual_access_on: "2026-01-01",
      },
      tasks: [],
      project: { id: "project", status: "active" },
      handoff: {
        id: "handoff",
        property_id: "home",
        status: "requested",
        gate_step: "kati_review",
      },
    },
    "Canonical PM",
  );

it("assigns each review queue to its separate current responsibility", () => {
  for (const [gateStep, role] of [
    ["kati_review", "director"],
    ["micah_review", "readiness"],
    ["operations_acceptance", "acceptance"],
    ["live_confirmation", "live"],
  ]) {
    const project = { ...summary(), gateStep: gateStep! };
    for (const candidate of ["director", "readiness", "acceptance", "live", "pm"]) {
      expect(matchesOnboardingLens(project, "mine", viewer(candidate))).toBe(candidate === role);
    }
    expect(workspaceSearchFromLens("mine", true).tab).toBe("handoff");
  }
});
it("keeps Director stage review distinct from PM execution and drills into reviewed work", () => {
  const project = { ...summary(), inReview: false, gateStep: null, stageReviewCount: 1 };
  expect(matchesOnboardingLens(project, "mine", viewer("director"))).toBe(true);
  expect(matchesOnboardingLens(project, "mine", viewer("pm"))).toBe(false);
  expect(workspaceSearchFromLens("mine", false)).toEqual({ tab: "work", workFilter: "review" });
});
it("removes Live projects from every action queue and preserves the portfolio", () => {
  const project = { ...summary(), stage: "live" as const };
  for (const lens of [
    "attention",
    "mine",
    "review",
    "corrections",
    "blocked",
    "at_risk",
    "handoffs",
    "up7",
    "up14",
    "up30",
  ] as Lens[]) {
    expect(matchesOnboardingLens(project, lens, viewer("director"))).toBe(false);
  }
  expect(matchesOnboardingLens(project, "all", viewer("director"))).toBe(true);
});
