import { describe, expect, it } from "bun:test";
import {
  approvalRef,
  findApprovalRefs,
  matchOwnerResponse,
  type ApprovalCandidate,
} from "../approval-reference";
import {
  OWNER_RESPONSE_TAG,
  OWNER_RESPONSE_FILED_TAG,
  CREATE_TICKET_TAG,
  alreadyTagged,
  categoriesAfterOwnerResponse,
  requestsOwnerResponse,
  triggerKind,
} from "../mail-categories";

const railing: ApprovalCandidate = {
  id: "00000000-0000-4000-8000-000000000001",
  ref: 1042,
  title: "Porch railing replacement",
  propertyId: "p1",
  ownerEmail: "owner@example.invalid",
  conversationId: "conv-a",
};
const paint: ApprovalCandidate = {
  id: "00000000-0000-4000-8000-000000000002",
  ref: 1043,
  title: "Exterior paint",
  propertyId: "p1",
  ownerEmail: "owner@example.invalid",
  conversationId: "conv-b",
};

describe("the reference on a homeowner's email", () => {
  it("reads back out of a reply subject, however it was typed", () => {
    expect(approvalRef(1042)).toBe("APR-1042");
    expect(findApprovalRefs("RE: Approval needed [APR-1042]")).toEqual([1042]);
    expect(findApprovalRefs("apr 1042 looks fine")).toEqual([1042]);
    expect(findApprovalRefs("no reference here")).toEqual([]);
  });
});

describe("placing a homeowner's reply", () => {
  it("the reference settles it, even when the same owner has other decisions open", () => {
    const m = matchOwnerResponse({
      subject: "RE: Approval needed — porch railing [APR-1042]",
      body: "Go ahead.",
      fromAddress: "owner@example.invalid",
      candidates: [railing, paint],
    });
    expect(m.approvalId).toBe(railing.id);
    expect(m.method).toBe("reference");
  });

  it("without a reference, the same email thread settles it", () => {
    const m = matchOwnerResponse({
      subject: "Re: your email",
      body: "Yes",
      conversationId: "conv-b",
      candidates: [railing, paint],
    });
    expect(m.approvalId).toBe(paint.id);
    expect(m.method).toBe("thread");
  });

  it("the sender is used only when they have exactly one decision waiting", () => {
    expect(
      matchOwnerResponse({
        subject: "ok",
        body: "yes",
        fromAddress: "owner@example.invalid",
        candidates: [railing],
      }).method,
    ).toBe("sender");
    const ambiguous = matchOwnerResponse({
      subject: "ok",
      body: "yes",
      fromAddress: "owner@example.invalid",
      candidates: [railing, paint],
    });
    expect(ambiguous.approvalId).toBeNull();
    expect(ambiguous.candidates.length).toBe(2);
  });

  it("a reply that cannot be placed is held, never guessed", () => {
    const m = matchOwnerResponse({
      subject: "Hello",
      body: "Thanks",
      fromAddress: "someone.else@example.invalid",
      candidates: [railing],
    });
    expect(m.approvalId).toBeNull();
    expect(m.reason).toBeTruthy();
  });

  it("a reference nobody recognises is held rather than attached to a neighbour", () => {
    const m = matchOwnerResponse({
      subject: "RE: [APR-9999]",
      body: "yes",
      fromAddress: "owner@example.invalid",
      candidates: [railing],
    });
    expect(m.approvalId).toBeNull();
  });
});

describe("the homeowner-response category", () => {
  it("is a filing instruction, never a create instruction", () => {
    expect(requestsOwnerResponse([OWNER_RESPONSE_TAG])).toBe(true);
    expect(triggerKind([OWNER_RESPONSE_TAG])).toBeNull();
    expect(triggerKind([CREATE_TICKET_TAG])).toBe("ticket");
  });

  it("a reply already filed is not filed twice", () => {
    expect(requestsOwnerResponse([OWNER_RESPONSE_TAG, OWNER_RESPONSE_FILED_TAG])).toBe(false);
    expect(alreadyTagged([OWNER_RESPONSE_FILED_TAG])).toBe(true);
  });

  it("filing swaps the category and keeps the team's own filing", () => {
    expect(categoriesAfterOwnerResponse(["Owner", OWNER_RESPONSE_TAG])).toEqual([
      "Owner",
      OWNER_RESPONSE_FILED_TAG,
    ]);
  });
});
