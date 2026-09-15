import type { ReviewRow } from "./owner-participation.server";
import type { OwnerTicket } from "./owner-ticket-projection.server";
import { ownerTicketRequest } from "./owner-ticket-authority";
import { opportunityDecisionPath } from "./owner-opportunity";

/** Current authority is read from canonical work; durable participation history stays on the review. */
export function automaticOpportunityView(review: ReviewRow, ticket?: OwnerTicket): ReviewRow {
  if (!review.auto_ticket) return review;
  const linked =
    ticket &&
    ticket.id === review.ticket_id &&
    ticket.property_id &&
    review.propertyIds.includes(ticket.property_id)
      ? ticket
      : undefined;
  const request = linked?.request ?? ownerTicketRequest([]);
  return {
    ...review,
    owner_request: request,
    title: linked?.title ?? "Recorded property work",
    owner_action_type: request.category,
    decision_path: opportunityDecisionPath(request.category),
    business_question: request.why,
    recommendation: `${request.label}. ${request.why} ${linked?.description ?? "Current property work details are unavailable."}`,
    staff_context: null,
  };
}
