import { describe, expect, it } from "vitest";
import { isOnboardingAction, ownerTrackProgress } from "@/lib/owner-onboarding";

const task = (title: string, stage: string, status: string) => ({ title, stage, status });

describe("owner onboarding projection", () => {
  it("counts finished work per track and overall", () => {
    const progress = ownerTrackProgress([
      task("Set up electric account", "scope_utilities_compliance", "complete"),
      task("Set up internet", "scope_utilities_compliance", "ready"),
      task("Mood board approval", "design_approvals_procurement", "complete"),
      task("Listing photos", "listing_final_clean", "in_progress"),
      task("Handoff acceptance", "handoff_acceptance", "carryover"),
    ]);

    const byKey = Object.fromEntries(progress.tracks.map((t) => [t.key, t]));
    expect(byKey["access_utilities"]!.done).toBe(1);
    expect(byKey["access_utilities"]!.total).toBe(2);
    expect(byKey["access_utilities"]!.percent).toBe(50);
    expect(byKey["furnishing_staging"]!.percent).toBe(100);
    expect(byKey["media_listing"]!.percent).toBe(0);
    // Carryover counts as finished work, same as the staff board.
    expect(byKey["ops_readiness"]!.done).toBe(1);
    expect(progress.done).toBe(3);
    expect(progress.total).toBe(5);
    expect(progress.percent).toBe(60);
  });

  it("always reports all four tracks, even with no tasks", () => {
    const progress = ownerTrackProgress([]);
    expect(progress.tracks).toHaveLength(4);
    expect(progress.percent).toBe(0);
    expect(progress.tracks.every((t) => t.total === 0 && t.percent === 0)).toBe(true);
  });

  it("separates onboarding decisions from other approvals", () => {
    expect(isOnboardingAction({ entity_type: "onboarding_task" })).toBe(true);
    expect(isOnboardingAction({ entity_type: "work_order" })).toBe(false);
    expect(isOnboardingAction({ entity_type: null })).toBe(false);
  });
});
