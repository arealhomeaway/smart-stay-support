import { z } from "zod";

const reviewedUpdateSchema = z.object({
  revision: z.number().int().positive(),
  issue: z.string(),
  work_performed: z.string(),
  outcome: z.string(),
  reviewed_at: z.string(),
});
export type ReviewedOwnerUpdate = z.infer<typeof reviewedUpdateSchema>;
export function parseReviewedOwnerUpdate(value: unknown): ReviewedOwnerUpdate | null {
  const result = reviewedUpdateSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Freeze the displayed context when logging opens; background refresh must not replace it. */
export function captureReviewedOpportunity(review: {
  id: string;
  phase: string;
  ticket_id: string | null;
  propertyIds: string[];
  owner_update_revision?: number | null;
  recommendation: string | null;
}) {
  return {
    id: review.id,
    phase: review.phase,
    ticketId: review.ticket_id,
    propertyIds: [...review.propertyIds],
    ownerUpdateRevision: review.owner_update_revision ?? null,
    description: review.recommendation,
  };
}

export function reviewedOwnerUpdateText(value: unknown): string {
  const update = parseReviewedOwnerUpdate(value);
  if (!update) return "";
  return `Owner update revision ${update.revision} (${update.reviewed_at.slice(0, 10)}). Issue: ${update.issue} Work: ${update.work_performed}${update.outcome ? ` Outcome: ${update.outcome}` : ""}`;
}

export function projectOwnerResponseReceipt(row: {
  id: string;
  review_id: string | null;
  created_at: string;
  detail: unknown;
}) {
  const detail =
    row.detail && typeof row.detail === "object" ? (row.detail as Record<string, unknown>) : {};
  return {
    id: row.id,
    reviewId: row.review_id,
    propertyId: z.string().uuid().safeParse(detail["propertyId"]).data ?? null,
    ticketId: z.string().uuid().safeParse(detail["ticketId"]).data ?? null,
    createdAt: row.created_at,
    response: typeof detail["response"] === "string" ? detail["response"] : "",
    ownerUpdate: parseReviewedOwnerUpdate(detail["ownerUpdate"]),
  };
}

/** Capture response narrative and optimistic-concurrency version together. */
export function captureReviewedResponse(
  review: Parameters<typeof captureReviewedOpportunity>[0] & { updated_at?: string; title: string },
) {
  return {
    ...captureReviewedOpportunity(review),
    expectedUpdatedAt: review.updated_at ?? "",
    title: review.title,
  };
}
