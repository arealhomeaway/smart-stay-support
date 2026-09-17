export type OwnerReplyDecision = "approved" | "declined" | "changes_requested";

export type OwnerReplyContext = {
  approvalId: string;
  expectedUpdatedAt: string;
  responseId: string | null;
  pending: boolean;
};

export type OwnerReplyDraft = {
  context: OwnerReplyContext;
  decision: OwnerReplyDecision | null;
  note: string;
};

/** Editing never adopts a newer approval or newly arrived reply implicitly. */
export function editOwnerReplyDraft(
  draft: OwnerReplyDraft | null,
  displayed: OwnerReplyContext,
  change: Partial<Pick<OwnerReplyDraft, "decision" | "note">>,
): OwnerReplyDraft {
  return {
    ...(draft ?? { context: { ...displayed }, decision: null, note: "" }),
    ...change,
  };
}

export function ownerReplyContextChanged(captured: OwnerReplyContext, current: OwnerReplyContext) {
  return (
    captured.approvalId !== current.approvalId ||
    captured.expectedUpdatedAt !== current.expectedUpdatedAt ||
    captured.responseId !== current.responseId ||
    captured.pending !== current.pending
  );
}

/** Only an explicit review confirmation may replace the captured context. */
export function adoptReviewedOwnerReplyContext(
  draft: OwnerReplyDraft,
  reviewed: OwnerReplyContext,
): OwnerReplyDraft {
  return { ...draft, context: { ...reviewed } };
}

export function ownerReplyDraftInput(draft: OwnerReplyDraft, current: OwnerReplyContext) {
  if (!current.pending || ownerReplyContextChanged(draft.context, current)) {
    throw new Error("Review the current approval and replies before saving this retained draft.");
  }
  if (!draft.decision || draft.note.trim().length < 3) {
    throw new Error("Choose the homeowner's answer and record its evidence.");
  }
  return {
    approvalId: draft.context.approvalId,
    expectedUpdatedAt: draft.context.expectedUpdatedAt,
    responseId: draft.context.responseId,
    decision: draft.decision,
    note: draft.note,
  };
}
