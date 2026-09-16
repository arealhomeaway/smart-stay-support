import type { ReviewRow } from "./owner-participation.server";
import { parseReviewPhotos } from "./owner-participation";

/** Owner transport fields only. Staff context and future columns never cross this boundary. */
export function ownerReviewProjection(review: ReviewRow): ReviewRow {
  return {
    id: review.id,
    ...(review.updated_at === undefined ? {} : { updated_at: review.updated_at }),
    auto_ticket: review.auto_ticket ?? false,
    owner_update_revision: review.owner_update_revision ?? null,
    phase: review.phase,
    stage: review.stage,
    title: review.title,
    task_type: review.task_type,
    recommendation: review.recommendation,
    business_question: review.business_question,
    evidence: review.auto_ticket ? null : review.evidence,
    impact: review.auto_ticket ? null : review.impact,
    decision_path: review.decision_path,
    respond_by: review.respond_by,
    status: review.status,
    owner_decision: review.owner_decision,
    owner_response: review.owner_response,
    outcome: review.auto_ticket ? null : review.outcome,
    responded_at: review.responded_at,
    ticket_id: review.ticket_id,
    attachment_path: review.auto_ticket ? null : review.attachment_path,
    source_type: review.source_type,
    onboarding_task_id: review.onboarding_task_id,
    owner_action_type: review.owner_action_type,
    available_from: review.available_from,
    staff_context: null,
    closed_at: review.closed_at,
    photos: review.auto_ticket ? [] : parseReviewPhotos(review.photos),
    sort_order: review.sort_order,
    propertyIds: [...review.propertyIds],
  };
}
