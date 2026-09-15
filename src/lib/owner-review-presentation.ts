import type { OwnerTicketRequest } from "./owner-ticket-authority";

export function ownerReviewPresentation(review: {
  auto_ticket?: boolean;
  owner_request?: OwnerTicketRequest;
  status: string;
  responded_at?: string | null;
}) {
  if (review.auto_ticket) {
    if (review.owner_request?.ownerActionRequired === true)
      return { attention: true, label: "Owner response required" };
    if (review.owner_request?.ownerActionRequired === false)
      return {
        attention: false,
        label: review.responded_at
          ? "Reviewed — No approval required"
          : "Review — No approval required",
      };
    return { attention: false, label: "Review — Authority unconfirmed" };
  }
  return {
    attention: ["awaiting_owner", "returned"].includes(review.status),
    label:
      review.status === "returned"
        ? "Sent back to you"
        : review.status === "answered"
          ? "Response recorded"
          : review.status === "closed"
            ? "Closed"
            : "Waiting on you",
  };
}
