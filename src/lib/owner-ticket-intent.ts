import { z } from "zod";
import { ACTION_TYPE_META } from "./owner-opportunity";

/** Financial approval is derived separately from canonical Work Order authority. */
export const REVIEWED_TICKET_REQUEST_TYPES = [
  "review_comment",
  "review_decide",
  "provide_information",
  "attend_respond",
  "action_payment",
  "information_only",
  "research_recommend",
] as const;
export const reviewedTicketRequestTypeSchema = z.enum(REVIEWED_TICKET_REQUEST_TYPES);
export type ReviewedTicketRequestType = z.infer<typeof reviewedTicketRequestTypeSchema>;
export const reviewedTicketRequestSchema = z.object({
  owner_request_type: reviewedTicketRequestTypeSchema,
  owner_request_why: z.string().trim().min(10).max(1000),
});
export type ReviewedTicketRequest = z.infer<typeof reviewedTicketRequestSchema>;

/** Legacy revisions have no explicit request; never infer one from private Ticket text. */
export function parseReviewedTicketRequest(value: unknown): ReviewedTicketRequest | null {
  const result = reviewedTicketRequestSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function reviewedTicketRequestText(value: unknown): string {
  const intent = parseReviewedTicketRequest(value);
  return intent
    ? `${ACTION_TYPE_META[intent.owner_request_type].label}: ${intent.owner_request_why}`
    : "";
}

/** A participation response reports activity; it does not certify operational fulfillment. */
export function ownerTicketResponseGuidance(category: string | undefined): string {
  if (category === "approve_only")
    return "This form records review notes. Approve or decline work through the separate approval request. Any reported action or payment still requires separate staff verification.";
  if (category === "action_payment")
    return "Describe the action or payment you report completing. Staff must verify it separately; this response does not confirm payment, completed work, or repair approval.";
  if (category === "review_decide")
    return "Record your decision and the reason for it. Staff will review your response; it does not grant repair or spending approval.";
  if (category === "provide_information")
    return "Provide the information requested in this reviewed update.";
  if (category === "attend_respond")
    return "Describe your attendance and response. Staff will verify any resulting operational action separately.";
  if (category === "research_recommend")
    return "Share your research and recommendation for staff review. A recommendation does not approve spending or work.";
  if (category === "review_comment")
    return "Share your comments on the reviewed update. Staff will review your response.";
  return "No response is required. You may record a review note and log time you actually spend reviewing this work.";
}
