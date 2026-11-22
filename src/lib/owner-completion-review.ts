/**
 * Owner completions to review (Nov 22): the list shows only completions the team has not reviewed
 * yet; reviewed ones sit in a folded Reviewed list with every review kept. Rows come from DB
 * owner_completions_for_review; history from append-only owner_completion_reviews.
 */
export type ReviewStatus = "needs_review" | "follow_up_needed" | "reviewed";

/** Rows that need staff attention: not yet reviewed, follow-up open, or new owner activity since review. */
export function needsAttention(r: { review_status: ReviewStatus; new_owner_activity: boolean }) {
  return r.review_status !== "reviewed" || r.new_owner_activity;
}

export function splitOwnerCompletions<T extends { review_status: ReviewStatus; new_owner_activity: boolean }>(rows: T[]) {
  return { toReview: rows.filter(needsAttention), reviewed: rows.filter((r) => !needsAttention(r)) };
}

export type ReviewHistoryRow = {
  id: string;
  work_item_id: string;
  status: ReviewStatus;
  internal_note: string | null;
  created_at: string;
  actor_id: string | null;
};

/** Every review of one completion, newest first. */
export function reviewHistoryFor(all: ReviewHistoryRow[], workItemId: string) {
  return all.filter((h) => h.work_item_id === workItemId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
