/** Browser-safe review helpers and labels. Rules themselves live in the database. */

export type StepReviewSettings = {
  template_task_id: string;
  reviewer_roles: string[];
  time_limit_business_days: number;
  alerts_enabled: boolean;
  blocks: "nothing" | "steps" | "handoff" | "stage";
  blocked_step_ids: string[];
  blocked_stage: string | null;
};

export type ReviewState = {
  enabled: boolean;
  settings: StepReviewSettings | null;
  review: { id: string; status: "pending" | "approved" | "changes_requested" | "skipped"; due_at: string | null; round: number } | null;
  reviewers: { role: string; user_id: string | null; name: string | null; decision: "approved" | "sent_back" | null }[];
  blocked_by: string | null;
  history: { kind: string; role: string | null; note: string | null; at: string; by: string }[];
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  changes_requested: "Changes requested",
  skipped: "Review skipped",
};

export const REVIEW_EVENT_LABEL: Record<string, string> = {
  submitted: "Submitted for review",
  resubmitted: "Resubmitted for review",
  approved: "Approved",
  sent_back: "Sent back",
  edited: "Edited directly",
  skipped: "Review skipped",
  overdue: "Review overdue",
  review_complete: "All reviews approved",
};

export const BLOCK_OPTIONS = [
  { value: "nothing", label: "Nothing" },
  { value: "steps", label: "Specific other steps" },
  { value: "handoff", label: "Handoff (Operations cannot accept until approved)" },
  { value: "stage", label: "Every step in a stage" },
] as const;

/** What the Task drawer's main action should be. */
export function reviewAction(state: ReviewState | null | undefined): "complete" | "submit" | "waiting" | "done" {
  if (!state?.enabled) return "complete";
  const s = state.review?.status;
  if (s === "pending") return "waiting";
  if (s === "approved" || s === "skipped") return "done";
  return "submit";
}

export function waitingLabel(blockedBy: string | null | undefined) {
  return blockedBy ? `Waiting on review of ${blockedBy}` : null;
}
