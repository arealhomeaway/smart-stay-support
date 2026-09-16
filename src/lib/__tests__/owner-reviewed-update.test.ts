import { expect, it } from "bun:test";
import {
  captureReviewedOpportunity,
  captureReviewedResponse,
  parseReviewedOwnerUpdate,
} from "../owner-reviewed-update";

it("retains the displayed revision, narrative and property links across refreshes", () => {
  const review = {
    id: "review",
    phase: "onboarding",
    ticket_id: "ticket",
    propertyIds: ["home"],
    owner_update_revision: 1,
    recommendation: "Initial repair",
  };
  const captured = captureReviewedOpportunity(review);
  review.owner_update_revision = 2;
  review.phase = "ongoing";
  review.recommendation = "Follow-up repair";
  review.propertyIds.push("another home");
  expect(captured).toEqual({
    id: "review",
    phase: "onboarding",
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
      phase: "onboarding",
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

it("freezes a response version with the narrative actually displayed", () => {
  const review = {
    id: "review",
    phase: "onboarding",
    title: "Work",
    ticket_id: "ticket",
    propertyIds: ["home"],
    updated_at: "first",
    owner_update_revision: 1,
    recommendation: "Original",
  };
  const draft = captureReviewedResponse(review);
  review.updated_at = "second";
  review.owner_update_revision = 2;
  review.phase = "ongoing";
  review.recommendation = "Revised";
  expect(draft.expectedUpdatedAt).toBe("first");
  expect(draft.ownerUpdateRevision).toBe(1);
  expect(draft.description).toBe("Original");
  expect(draft.phase).toBe("onboarding");
});

it("exposes only response text and allowlisted narrative fields from a receipt", async () => {
  const { projectOwnerResponseReceipt } = await import("../owner-reviewed-update");
  const receipt = projectOwnerResponseReceipt({
    id: "receipt",
    review_id: "review",
    created_at: "date",
    detail: {
      response: "My note",
      propertyId: "33333333-3333-4333-8333-333333333333",
      ticketId: "not-a-Ticket-id",
      private_note: "SECRET",
      ownerUpdate: {
        revision: 1,
        issue: "Issue",
        work_performed: "Work",
        outcome: "Done",
        reviewed_at: "date",
        access_code: "SECRET",
      },
    },
  });
  expect(receipt.response).toBe("My note");
  expect(receipt.propertyId).toBe("33333333-3333-4333-8333-333333333333");
  expect(receipt.ticketId).toBe(null);
  expect(receipt.ownerUpdate?.revision).toBe(1);
  expect(JSON.stringify(receipt).includes("SECRET")).toBe(false);
});

it("freezes the response request category and retains request WHY in safe history exports", async () => {
  const { reviewedOwnerUpdateText } = await import("../owner-reviewed-update");
  const { ownerTicketRequest } = await import("../owner-ticket-authority");
  const review = {
    id: "review",
    phase: "ongoing",
    title: "Property work",
    ticket_id: "ticket",
    propertyIds: ["home"],
    recommendation: "The reviewed action",
    owner_update_revision: 2,
    updated_at: "first",
    owner_request: ownerTicketRequest([{ quote_amount: 150 }], {
      owner_request_type: "action_payment",
      owner_request_why: "Please report completion for staff verification.",
    }),
  };
  const captured = captureReviewedResponse(review);
  review.owner_request = ownerTicketRequest([{ quote_amount: 150 }]);
  expect(captured.requestCategory).toBe("action_payment");
  const snapshot = {
    revision: 2,
    issue: "Issue",
    work_performed: "Work",
    outcome: "Outcome",
    reviewed_at: "2026-09-16",
    owner_request_type: "action_payment",
    owner_request_why: "Please report completion for staff verification.",
    private_note: "SECRET",
  };
  expect(parseReviewedOwnerUpdate(snapshot)?.owner_request_type).toBe("action_payment");
  expect(reviewedOwnerUpdateText(snapshot)).toContain("Action or payment required");
  expect(reviewedOwnerUpdateText(snapshot)).toContain("staff verification");
  expect(reviewedOwnerUpdateText(snapshot).includes("SECRET")).toBe(false);
  expect(
    parseReviewedOwnerUpdate({ ...snapshot, owner_request_type: null, owner_request_why: null })
      ?.revision,
  ).toBe(2);
});
