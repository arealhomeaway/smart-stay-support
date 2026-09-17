import { expect, it } from "bun:test";
import { automaticOpportunityView } from "../owner-automatic-opportunity";
import type { ReviewRow } from "../owner-participation.server";
import type { OwnerTicket } from "../owner-ticket-projection.server";
import { ownerTicketRequest } from "../owner-ticket-authority";
import { MAINTENANCE_POLICY } from "../maintenance-policy";

const review = {
  id: "review",
  auto_ticket: true,
  ticket_id: "ticket",
  propertyIds: ["home"],
  status: "answered",
  owner_response: "My recorded response",
} as ReviewRow;
const ticket = {
  id: "ticket",
  property_id: "home",
  title: "Maintenance · Ticket #42",
  description: "Published context pending",
  request: ownerTicketRequest([{ quote_amount: 150 }]),
} as OwnerTicket;
it("renders current canonical request and WHY while preserving the opportunity and response", () => {
  const view = automaticOpportunityView(review, ticket);
  expect(view.id).toBe("review");
  expect(view.status).toBe("answered");
  expect(view.owner_response).toBe("My recorded response");
  expect(view.recommendation).toContain("Review — No approval required");
  const approval = automaticOpportunityView(review, {
    ...ticket,
    request: ownerTicketRequest([{ quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1 }]),
  });
  expect(approval.owner_action_type).toBe("approve_only");
  expect(approval.decision_path).toBe("approve");
});
it("does not derive authority from another property or a missing Ticket", () => {
  for (const source of [
    undefined,
    { ...ticket, property_id: "other" },
    { ...ticket, id: "other" },
  ]) {
    const view = automaticOpportunityView(review, source);
    expect(view.recommendation).toContain("Authority not yet confirmed");
  }
});
