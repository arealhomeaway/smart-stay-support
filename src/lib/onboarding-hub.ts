import {
  canReviewOnboardingGate,
  type OnboardingReviewCapabilities,
} from "./onboarding-review-capabilities";
import { withinDays, type ProjectSummary } from "./onboarding-lifecycle";

export type Lens =
  | "attention"
  | "mine"
  | "at_risk"
  | "blocked"
  | "review"
  | "corrections"
  | "handoffs"
  | "up7"
  | "up14"
  | "up30"
  | "reviews"
  | "pipeline"
  | "all";

export type HubViewer = {
  userId: string | null;
  /** True for Director / Operations reviewers who own a gate decision. */
  reviewCapabilities: OnboardingReviewCapabilities;
};

export function awaitingMyReview(p: ProjectSummary, viewer?: HubViewer) {
  if (!viewer) return false;
  if (p.stageReviewCount > 0 && viewer.reviewCapabilities.can_review_stages) return true;
  return p.inReview && canReviewOnboardingGate(viewer.reviewCapabilities, p.gateStep);
}

/**
 * Every lens reads the same authoritative summary, so the counts reconcile:
 * a live home appears in no attention queue, "blocked" and "at risk" are
 * mutually exclusive derived levels, and a project in review is never also
 * counted as needing a project manager's action.
 */
export function matchesOnboardingLens(p: ProjectSummary, lens: Lens, viewer?: HubViewer) {
  // Keep accepted homes visible until the Supervisor confirms Live.
  const live = p.stage === "live";
  switch (lens) {
    case "attention":
      return (
        !live &&
        (p.risk.level === "blocked" ||
          p.risk.level === "at_risk" ||
          p.property.lifecycle_status === "handoff_corrections" ||
          p.stageCorrectionCount > 0)
      );
    case "reviews":
      return !live && (p.inReview || p.stageReviewCount > 0 || withinDays(p.target, 14));
    case "pipeline":
      return !live;
    case "mine":
      return !live && awaitingMyReview(p, viewer);
    case "at_risk":
      return !live && p.risk.level === "at_risk";
    case "blocked":
      return !live && p.risk.level === "blocked";
    case "review":
      return !live && (p.inReview || p.stageReviewCount > 0);
    case "corrections":
      return (
        !live &&
        (p.property.lifecycle_status === "handoff_corrections" || p.stageCorrectionCount > 0)
      );
    case "handoffs":
      return !live && withinDays(p.target, 14);
    case "up7":
      return !live && withinDays(p.target, 7);
    case "up14":
      return !live && withinDays(p.target, 14);
    case "up30":
      return !live && withinDays(p.target, 30);
    default:
      return true;
  }
}
