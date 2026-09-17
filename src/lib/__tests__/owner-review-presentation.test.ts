import { expect, it } from "bun:test";
import { ownerReviewPresentation } from "../owner-review-presentation";
import { ownerTicketRequest } from "../owner-ticket-authority";
import { MAINTENANCE_POLICY } from "../maintenance-policy";
it("keeps review-only participation available without presenting it as an owner obligation", () => {
  const review = {
    auto_ticket: true,
    status: "awaiting_owner",
    owner_request: ownerTicketRequest([{ quote_amount: 150 }]),
  };
  expect(ownerReviewPresentation(review).attention).toBe(false);
  expect(ownerReviewPresentation({ ...review, responded_at: "2026-09-15" }).label).toBe(
    "Reviewed — No approval required",
  );
});
it("does not let an acknowledgement hide a required owner decision", () => {
  const review = {
    auto_ticket: true,
    status: "answered",
    responded_at: "2026-09-15",
    owner_request: ownerTicketRequest([
      { quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1 },
    ]),
  };
  expect(ownerReviewPresentation(review).attention).toBe(true);
  expect(ownerReviewPresentation(review).label).toBe("Owner response required");
});
it("keeps unconfirmed authority distinct and preserves manual task attention", () => {
  expect(ownerReviewPresentation({ auto_ticket: true, status: "awaiting_owner" }).label).toBe(
    "Review — Authority unconfirmed",
  );
  expect(ownerReviewPresentation({ status: "returned" }).attention).toBe(true);
  expect(ownerReviewPresentation({ status: "answered" }).attention).toBe(false);
});
