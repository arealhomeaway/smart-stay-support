/** Operations decision, 2026-09-17. Pure rules; persistence must enforce the same gates. */
export const CLEANING_TEMPLATES = {
  okcDeparture: {
    id: 581109,
    name: "ARHA Departure Clean (Updated)",
    kind: "departure",
    market: "OKC",
    status: "active",
  },
  otherDeparture: {
    id: 581110,
    name: "Non- OKC ARHA Departure Clean (Updated)",
    kind: "departure",
    market: "non-OKC",
    status: "active",
  },
  qualityArrival: {
    id: 32834,
    name: "ARHA Quality and Arrival Inspection",
    kind: "inspection",
    market: "all",
    status: "active",
  },
  vacancy: {
    id: 818192,
    name: "ARHA Vacancy Cleaning",
    kind: "vacancy",
    market: "all",
    status: "active",
  },
  legacyOkcDeparture: {
    id: 32833,
    name: "ARHA Departure Clean",
    kind: "departure",
    market: "OKC",
    status: "legacy",
  },
  legacyOtherDeparture: {
    id: 243197,
    name: "Non-OKC ARHA Departure Clean",
    kind: "departure",
    market: "non-OKC",
    status: "legacy",
  },
  suggestedInspection: {
    id: 588039,
    name: "ARHA Quality and Arrival Inspection (Suggested Updates)",
    kind: "inspection",
    market: "all",
    status: "unused",
  },
  offsiteInspection: {
    id: 277186,
    name: "ARHA Quality and Arrival Inspection (off-site)",
    kind: "inspection",
    market: "all",
    status: "review_needed",
  },
} as const;

export function departureTemplateForMarket(market: string): 581109 | 581110 {
  return market.trim().toUpperCase() === "OKC" ? 581109 : 581110;
}

export const CLEANING_TASK_STATES = [
  "scheduled",
  "offered",
  "pending_acceptance",
  "accepted",
  "in_progress",
  "submitted",
  "pending_review",
  "approved",
  "correction_required",
  "reopened_in_progress",
  "declined",
  "expired",
  "closed_cancelled",
] as const;
export type CleaningTaskState = (typeof CLEANING_TASK_STATES)[number];

const transitions: Record<CleaningTaskState, readonly CleaningTaskState[]> = {
  scheduled: ["offered", "pending_acceptance", "accepted", "closed_cancelled"],
  offered: ["pending_acceptance", "accepted", "declined", "expired", "closed_cancelled"],
  pending_acceptance: ["accepted", "declined", "expired", "closed_cancelled"],
  accepted: ["in_progress", "closed_cancelled"],
  in_progress: ["submitted", "closed_cancelled"],
  submitted: ["pending_review"],
  pending_review: ["approved", "correction_required"],
  approved: ["reopened_in_progress"],
  correction_required: ["reopened_in_progress", "closed_cancelled"],
  reopened_in_progress: ["submitted", "closed_cancelled"],
  declined: ["offered", "closed_cancelled"],
  expired: ["offered", "closed_cancelled"],
  closed_cancelled: [],
};

export function canTransitionCleaningTask(from: CleaningTaskState, to: CleaningTaskState): boolean {
  return transitions[from].includes(to);
}

export type ReadinessInput = {
  hasCheckout: boolean;
  cleaningState?: CleaningTaskState;
  inspectionState?: CleaningTaskState;
  urgentIssueOpen: boolean;
  otherReadinessBlockerOpen: boolean;
};
export type PropertyReadiness =
  | "Dirty"
  | "Cleaning"
  | "Pending Inspection"
  | "Inspecting"
  | "Correction Required"
  | "Blocked"
  | "Ready";

export function derivePropertyReadiness(input: ReadinessInput): PropertyReadiness {
  if (input.urgentIssueOpen || input.otherReadinessBlockerOpen) return "Blocked";
  if (
    input.cleaningState === "correction_required" ||
    input.inspectionState === "correction_required"
  )
    return "Correction Required";
  if (input.inspectionState === "in_progress" || input.inspectionState === "reopened_in_progress")
    return "Inspecting";
  if (input.cleaningState === "in_progress" || input.cleaningState === "reopened_in_progress")
    return "Cleaning";
  if (input.cleaningState === "approved" && input.inspectionState === "approved") return "Ready";
  if (
    input.cleaningState === "submitted" ||
    input.cleaningState === "pending_review" ||
    input.cleaningState === "approved"
  )
    return "Pending Inspection";
  return input.hasCheckout ? "Dirty" : "Ready";
}

export const CLEANING_FINDING_CODES = [
  ["CARPET_STAIN", "Carpet stain"],
  ["EXTRA_CLEANING", "Extra cleaning"],
  ["MINOR_CAT_DAMAGE", "Minor cat damage"],
  ["MAJOR_CAT_DAMAGE", "Major cat damage"],
  ["MINOR_DOG_DAMAGE", "Minor dog damage"],
  ["MAJOR_DOG_DAMAGE", "Major dog damage"],
  ["EXCESSIVE_PET_HAIR", "Excessive pet hair"],
  ["LINEN_OR_TOWEL_DAMAGE", "Linen or towel damage"],
  ["SMOKING_MARIJUANA", "Smoking marijuana"],
  ["SMOKING_CIGARETTES", "Smoking cigarettes"],
  ["FURNITURE_DAMAGE", "Furniture damage"],
  ["RUG_DAMAGE", "Rug damage"],
  ["LATE_CHECKOUT_UNDER_ONE_HOUR", "Late checkout under one hour"],
  ["LATE_CHECKOUT_OVER_ONE_HOUR", "Late checkout over one hour"],
] as const;
