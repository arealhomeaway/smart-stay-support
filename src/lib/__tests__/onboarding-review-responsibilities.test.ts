import { expect, it } from "bun:test";
import {
  canReviewOnboardingGate,
  type OnboardingReviewCapabilities,
} from "../onboarding-review-capabilities";
import {
  prepareOnboardingHandoff,
  type OnboardingHandoffSnapshot,
} from "../onboarding-handoff-readiness";
import { stageReviewMatchesWork } from "../onboarding-stage";

const none: OnboardingReviewCapabilities = {
  is_admin: false,
  can_review_stages: false,
  kati_review: false,
  micah_review: false,
  operations_acceptance: false,
  live_confirmation: false,
};
it("uses the same explicit role-specific gates and never treats a generic manager or unknown gate as a review", () => {
  for (const step of [
    "kati_review",
    "micah_review",
    "operations_acceptance",
    "live_confirmation",
  ] as const) {
    const own = { ...none, [step]: true };
    expect(canReviewOnboardingGate(own, step)).toBe(true);
    expect(canReviewOnboardingGate(none, step)).toBe(false);
    for (const other of [
      "kati_review",
      "micah_review",
      "operations_acceptance",
      "live_confirmation",
    ].filter((value) => value !== step))
      expect(canReviewOnboardingGate(own, other)).toBe(false);
    expect(canReviewOnboardingGate(own, "complete")).toBe(false);
  }
});
function snapshot(status = "carryover") {
  const task = {
    id: "task",
    property_id: "home",
    title: "Inspection",
    stage: "post_contract",
    status,
    blocks_handoff: false,
    requires_owner_approval: false,
    owner_approval_status: "not_required",
    evidence_required: false,
    evidence_note: null,
    blocker: null,
    assigned_to: "staff",
    due_on: "2026-09-30",
    carryover_reason: "Accepted follow-up",
    completed_at: null,
  };
  const scope = { modules: [], furnishing_scope: "full_furnishing", director: null };
  return {
    property: {
      id: "home",
      name: "Home",
      lifecycle_status: "onboarding",
      address_line1: "1 Main",
      city: "Town",
      state: "TX",
      postal_code: "77000",
      latitude: 1,
      longitude: 2,
      access_notes: "Reviewed access",
      quarterly_review_due_on: null,
      handoff_accepted_at: null,
    },
    project: { id: "project", status: "active", ...scope },
    tasks: [task],
    pendingFacts: [],
    stageCaptures: [
      {
        stage: "post_contract",
        revision: 2,
        status: "complete",
        observation: "Inspected",
        evidenceIds: [],
        reason: "",
        actor: "director",
        recordedAt: "2026-09-16T00:00:00Z",
        taskSnapshot: [{ ...task }],
        scopeSnapshot: scope,
      },
    ],
  } as unknown as OnboardingHandoffSnapshot;
}
it("retains already-designated carryover and requires its explicit acceptance", () => {
  const s = snapshot();
  expect(() => prepareOnboardingHandoff(s, false)).toThrow("Explicitly accept");
  expect(prepareOnboardingHandoff(s, true).openTaskIds).toEqual(["task"]);
  expect(prepareOnboardingHandoff(s, true).applicableTaskIds).toEqual(["task"]);
});
it("carryover consent cannot excuse missing approval, assignment, or renewed stage review", () => {
  const s = snapshot();
  s.tasks[0]!.requires_owner_approval = true;
  s.tasks[0]!.owner_approval_status = "pending";
  expect(() => prepareOnboardingHandoff(s, true)).toThrow("blocked");
  const unassigned = snapshot();
  unassigned.tasks[0]!.assigned_to = null;
  unassigned.stageCaptures[0]!.taskSnapshot = unassigned.tasks.map((task) => ({ ...task }));
  expect(() => prepareOnboardingHandoff(unassigned, true)).toThrow("assigned owner");
  const legacy = snapshot("complete");
  delete legacy.stageCaptures[0]!.taskSnapshot;
  expect(() => prepareOnboardingHandoff(legacy, false)).toThrow("Stage reviews outstanding");
});
it("compares the actual reviewed work and scope while retaining the old receipt", () => {
  const s = snapshot("complete"),
    capture = s.stageCaptures[0]!;
  expect(stageReviewMatchesWork(capture, s.tasks, s.project)).toBe(true);
  s.tasks[0]!.title = "Changed findings";
  expect(stageReviewMatchesWork(capture, s.tasks, s.project)).toBe(false);
  expect(capture.taskSnapshot?.[0]?.title).toBe("Inspection");
  const changedScope = snapshot("complete");
  changedScope.project!.modules = ["pool"];
  expect(
    stageReviewMatchesWork(changedScope.stageCaptures[0], changedScope.tasks, changedScope.project),
  ).toBe(false);
});
