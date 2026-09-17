import { expect, it } from "bun:test";
import { ACTION_TYPE_META } from "../owner-opportunity";
import { MAINTENANCE_POLICY } from "../maintenance-policy";
import { ownerTicketRequest } from "../owner-ticket-authority";
import {
  ownerTicketResponseGuidance,
  parseReviewedTicketRequest,
  REVIEWED_TICKET_REQUEST_TYPES,
  reviewedTicketRequestText,
} from "../owner-ticket-intent";

it("uses each Welcome Packet request from reviewed canonical Ticket intent", () => {
  for (const type of REVIEWED_TICKET_REQUEST_TYPES) {
    const intent = {
      owner_request_type: type,
      owner_request_why: "Explain the request for this actual property work.",
    };
    const request = ownerTicketRequest([{ quote_amount: 150 }], intent);
    expect(request.category).toBe(type);
    expect(request.ownerActionRequired).toBe(type !== "information_only");
    expect(request.why).toContain(ACTION_TYPE_META[type].label);
    expect(request.why).toContain(intent.owner_request_why);
    expect(request.why).toContain("$150");
  }
});
it("keeps canonical financial approval primary without losing a separate explicit request", () => {
  const request = ownerTicketRequest(
    [{ quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1 }],
    {
      owner_request_type: "provide_information",
      owner_request_why: "Please supply the appliance model so staff can confirm the quote.",
    },
  );
  expect(request.category).toBe("approve_only");
  expect(request.ownerActionRequired).toBe(true);
  expect(request.why).toContain("Provide information");
  expect(request.why).toContain("appliance model");
});
it("never turns missing authority or a declined repair into permission through a staff request", () => {
  const intent = {
    owner_request_type: "action_payment",
    owner_request_why: "Please report whether the requested action has been completed.",
  };
  const unknown = ownerTicketRequest([], intent);
  expect(unknown.category).toBe("action_payment");
  expect(unknown.why).toContain("does not confirm permission");
  const declined = ownerTicketRequest(
    [{ quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1, approval_status: "declined" }],
    intent,
  );
  expect(declined.why).toContain("does not authorize");
  expect(ownerTicketResponseGuidance(unknown.category)).toContain("Staff must verify");
  expect(ownerTicketResponseGuidance(unknown.category)).toContain("does not confirm payment");
});
it("treats explicit information-only revisions as review participation without erasing authority limits", () => {
  const intent = {
    owner_request_type: "information_only",
    owner_request_why: "Staff verified the information. No further owner action is requested.",
  };
  expect(ownerTicketRequest([{ quote_amount: 150 }], intent).ownerActionRequired).toBe(false);
  expect(ownerTicketRequest([], intent).ownerActionRequired).toBe(null);
  expect(ownerTicketRequest([{ quote_amount: 150 }], intent).why).toContain(
    "No further owner action",
  );
});
it("rejects malformed or financial intent and never infers intent from old/private metadata", () => {
  for (const value of [
    null,
    {},
    { owner_request_type: null, owner_request_why: null },
    { owner_request_type: "approve_only", owner_request_why: "Forged repair permission" },
    { owner_request_type: "research_recommend", owner_request_why: " " },
    { owner_request_type: "private credential", owner_request_why: "PRIVATE" },
  ]) {
    expect(parseReviewedTicketRequest(value)).toBe(null);
    expect(ownerTicketRequest([{ quote_amount: 150 }], value)).toEqual(
      ownerTicketRequest([{ quote_amount: 150 }]),
    );
    expect(reviewedTicketRequestText(value)).toBe("");
  }
});
it("separates operational response guidance from financial approval", () => {
  expect(ownerTicketResponseGuidance("approve_only")).toContain("separate approval request");
  expect(ownerTicketResponseGuidance("review_decide")).toContain("does not grant repair");
  expect(ownerTicketResponseGuidance("research_recommend")).toContain("does not approve spending");
  for (const type of ["provide_information", "attend_respond", "review_comment"])
    expect(ownerTicketResponseGuidance(type).includes("separate approval request")).toBe(false);
  expect(ownerTicketResponseGuidance("information_only")).toContain("No response is required");
});
