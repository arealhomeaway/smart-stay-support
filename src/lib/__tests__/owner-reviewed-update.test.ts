import { expect, it } from "bun:test";
import { captureReviewedOpportunity, parseReviewedOwnerUpdate } from "../owner-reviewed-update";

it("retains the displayed revision, narrative and property links across refreshes", () => {
  const review = {
    id: "review",
    ticket_id: "ticket",
    propertyIds: ["home"],
    owner_update_revision: 1,
    recommendation: "Initial repair",
  };
  const captured = captureReviewedOpportunity(review);
  review.owner_update_revision = 2;
  review.recommendation = "Follow-up repair";
  review.propertyIds.push("another home");
  expect(captured).toEqual({
    id: "review",
    ticketId: "ticket",
    propertyIds: ["home"],
    ownerUpdateRevision: 1,
    description: "Initial repair",
  });
});
it("does not invent a revision for legacy opportunities and parses only safe snapshot fields", () => {
  expect(
    captureReviewedOpportunity({
      id: "review",
      ticket_id: null,
      propertyIds: [],
      recommendation: null,
    }).ownerUpdateRevision,
  ).toBe(null);
  const snapshot = {
    revision: 1,
    issue: "Leak",
    work_performed: "Repaired",
    outcome: "Test passed",
    reviewed_at: "2026-09-15",
    internal_note: "PRIVATE",
  };
  expect(JSON.stringify(parseReviewedOwnerUpdate(snapshot)).includes("PRIVATE")).toBe(false);
  expect(parseReviewedOwnerUpdate(null)).toBe(null);
  expect(parseReviewedOwnerUpdate({ revision: 0 })).toBe(null);
});
