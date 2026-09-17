export type OnboardingReviewCapabilities = {
  is_admin: boolean;
  can_review_stages: boolean;
  kati_review: boolean;
  micah_review: boolean;
  operations_acceptance: boolean;
  live_confirmation: boolean;
};

export function canReviewOnboardingGate(
  capabilities: OnboardingReviewCapabilities,
  step: string | null,
) {
  switch (step ?? "kati_review") {
    case "kati_review":
      return capabilities.kati_review;
    case "micah_review":
      return capabilities.micah_review;
    case "operations_acceptance":
      return capabilities.operations_acceptance;
    case "live_confirmation":
      return capabilities.live_confirmation;
    default:
      return false;
  }
}

export function hasOnboardingReview(capabilities: OnboardingReviewCapabilities) {
  return (
    capabilities.can_review_stages ||
    capabilities.kati_review ||
    capabilities.micah_review ||
    capabilities.operations_acceptance ||
    capabilities.live_confirmation
  );
}
