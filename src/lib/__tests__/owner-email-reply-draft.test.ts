import { describe, expect, it } from "bun:test";
import {
  editOwnerReplyDraft,
  ownerReplyContextChanged,
  ownerReplyDraftInput,
  adoptReviewedOwnerReplyContext,
  type OwnerReplyContext,
} from "../owner-email-reply-draft";

const displayed: OwnerReplyContext = {
  approvalId: "approval-a",
  expectedUpdatedAt: "2026-09-16T12:00:00Z",
  responseId: "reply-a",
  pending: true,
};

describe("retained owner email reply drafts", () => {
  it("keeps the viewed approval and reply while editing after a background refresh", () => {
    let draft = editOwnerReplyDraft(null, displayed, { note: "Owner approved the stated scope." });
    const refreshed = {
      ...displayed,
      expectedUpdatedAt: "2026-09-16T13:00:00Z",
      responseId: "reply-b",
    };
    draft = editOwnerReplyDraft(draft, refreshed, { decision: "approved" });
    expect(draft.context).toEqual(displayed);
    expect(draft.note).toBe("Owner approved the stated scope.");
    expect(ownerReplyContextChanged(draft.context, refreshed)).toBe(true);
    expect(() => ownerReplyDraftInput(draft, refreshed)).toThrow("Review the current approval");
  });

  it("does not attach a newly arrived reply to a draft that began without one", () => {
    const withoutReply = { ...displayed, responseId: null };
    const draft = editOwnerReplyDraft(null, withoutReply, {
      decision: "declined",
      note: "Owner declined by phone; meeting note retained.",
    });
    expect(ownerReplyDraftInput(draft, withoutReply).responseId).toBe(null);
    expect(() => ownerReplyDraftInput(draft, displayed)).toThrow("Review the current approval");
    expect(draft.context.responseId).toBe(null);
  });

  it("recaptures only explicitly reviewed details without discarding the staff draft", () => {
    const draft = editOwnerReplyDraft(null, displayed, {
      decision: "changes_requested",
      note: "Owner requested a smaller scope, as documented in the reply.",
    });
    const current = {
      ...displayed,
      expectedUpdatedAt: "2026-09-16T13:00:00Z",
      responseId: "reply-b",
    };
    const reviewed = adoptReviewedOwnerReplyContext(draft, current);
    expect(reviewed.note).toBe(draft.note);
    expect(reviewed.decision).toBe(draft.decision);
    expect(ownerReplyDraftInput(reviewed, current)).toEqual({
      approvalId: current.approvalId,
      expectedUpdatedAt: current.expectedUpdatedAt,
      responseId: current.responseId,
      decision: "changes_requested",
      note: draft.note,
    });
    expect(draft.context).toEqual(displayed);
  });

  it("retains but cannot submit a draft after the approval closes", () => {
    const draft = editOwnerReplyDraft(null, displayed, {
      decision: "approved",
      note: "Owner agrees.",
    });
    const closed = { ...displayed, pending: false };
    expect(() => ownerReplyDraftInput(draft, closed)).toThrow("Review the current approval");
    const reviewed = adoptReviewedOwnerReplyContext(draft, closed);
    expect(() => ownerReplyDraftInput(reviewed, closed)).toThrow("Review the current approval");
    expect(reviewed.note).toBe("Owner agrees.");
  });
});
