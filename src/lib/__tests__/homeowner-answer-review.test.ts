import { describe, expect, it } from "bun:test";
import { answerRows, canReviewAnswers, reviewFor, splitAnswers, type AnswerReview } from "@/lib/homeowner-answer-review";
import type { HomeownerStatusData, StatusReview } from "@/lib/homeowner-status";

const HOME = "11111111-1111-4111-8111-111111111111";
const REVIEW_ID = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-12-20T15:00:00Z");

function data(over: Partial<HomeownerStatusData> = {}): HomeownerStatusData {
  const r: StatusReview = {
    id: REVIEW_ID, title: "Pick the paint", status: "answered", sentAt: "2026-10-01T15:00:00Z", sentBy: null,
    respondedAt: "2026-10-02T15:00:00Z", closedAt: null, decision: null, response: "Grey, please",
    lastOwnerMessage: null, files: [], propertyId: HOME, taskId: "task-1", ownerAnsweredAt: null,
  } as StatusReview;
  return { cards: [], reviews: [r], cardReviews: {}, approvals: [], planOn: {}, homeLabels: { [HOME]: "1 Main St" }, ...over };
}
const review = (answerAt: string, reviewedAt = "2026-12-01T15:00:00Z"): AnswerReview => ({
  itemKey: `review:${REVIEW_ID}`, answerAt, reviewedBy: "pm-1", reviewedAt,
});

describe("Homeowner answers to review on My Tasks (Nov 22)", () => {
  it("an answer older than 7 days still shows until it is reviewed", () => {
    const rows = answerRows(data(), new Set([HOME]), now);
    expect(rows.map((r) => r.itemKey)).toEqual([`review:${REVIEW_ID}`]);
    expect(splitAnswers(rows, []).toReview.length).toBe(1);
  });
  it("Reviewed moves it to the Reviewed list with who and when", () => {
    const rows = answerRows(data(), new Set([HOME]), now);
    const { toReview, reviewed } = splitAnswers(rows, [review("2026-10-02T15:00:00Z")]);
    expect(toReview).toEqual([]);
    expect(reviewed[0]?.review.reviewedBy).toBe("pm-1");
    expect(reviewed[0]?.review.reviewedAt).toBe("2026-12-01T15:00:00Z");
  });
  it("a newer answer from the homeowner brings it back to review", () => {
    const later = data();
    later.reviews[0]!.ownerAnsweredAt = "2026-12-10T15:00:00Z";
    const rows = answerRows(later, new Set([HOME]), now);
    expect(rows[0]?.answerAt).toBe("2026-12-10T15:00:00Z");
    expect(splitAnswers(rows, [review("2026-10-02T15:00:00Z")]).toReview.length).toBe(1);
    expect(reviewFor(rows[0]!, [review("2026-12-10T15:00:00Z")])).not.toBeNull();
  });
  it("a homeowner change to a listed owner item counts as a new answer on that item, not a second row", () => {
    const changed = data({ updates: [{ id: "33333333-3333-4333-8333-333333333333", propertyId: HOME, title: "Pick the paint", taskId: "task-1", at: "2026-12-12T15:00:00Z", kind: "owner_item", itemId: REVIEW_ID }] });
    const rows = answerRows(changed, new Set([HOME]), now);
    expect(rows.length).toBe(1);
    expect(rows[0]?.answerAt).toBe("2026-12-12T15:00:00Z");
  });
  it("the home's Project Manager may press Reviewed; another teammate may not; Director and Admin cover", () => {
    const base = { userId: "pm-1", projectManager: "pm-1", isOnboardingDirector: false, isAdmin: false };
    expect(canReviewAnswers(base)).toBe(true);
    expect(canReviewAnswers({ ...base, userId: "pm-2" })).toBe(false);
    expect(canReviewAnswers({ ...base, userId: "dir", isOnboardingDirector: true })).toBe(true);
    expect(canReviewAnswers({ ...base, userId: "adm", isAdmin: true })).toBe(true);
  });
});
