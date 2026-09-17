export type ReviewDecision = "approved" | "returned" | "flagged";

export type TimeReviewRow = {
  id: string;
  programId: string;
  ownerName: string | null;
  entryDate: string;
  minutes: number;
  phase: string;
  activity: string;
  activityCategory: string | null;
  output: string | null;
  reviewStatus: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewVersion: string;
  flagged: boolean;
  propertyNames: string[];
  createdAt: string;
};

/** A cache refresh must not replace the entry/version attached to a review draft. */
export function captureOwnerTimeReview(
  entry: TimeReviewRow,
  decision: ReviewDecision = "approved",
  note = "",
) {
  return { entry: { ...entry, propertyNames: [...entry.propertyNames] }, decision, note };
}

export type OwnerTimeReviewDraft = ReturnType<typeof captureOwnerTimeReview>;

/** Include displayed context as well as the database version, including renamed homes. */
export function ownerTimeReviewChanged(
  draft: OwnerTimeReviewDraft,
  current: TimeReviewRow | undefined,
) {
  if (!current) return true;
  const snapshot = (entry: TimeReviewRow) =>
    JSON.stringify({ ...entry, propertyNames: [...entry.propertyNames].sort() });
  return snapshot(draft.entry) !== snapshot(current);
}

export function ownerTimeReviewInput(draft: OwnerTimeReviewDraft) {
  return {
    entryId: draft.entry.id,
    expectedVersion: draft.entry.reviewVersion,
    decision: draft.decision,
    note: draft.note.trim(),
  };
}
