-- homeowner-answer-review undo: removes the Reviewed action, the append-only rule and the review record.
-- The reviews saved since apply are copied into the audit log first, so their history is kept.
-- My homeowners then shows its 7-day answered list again (the screen checks for the record).
INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
SELECT NULL, 'homeowner_answer_review.undone', 'function', NULL, 'Homeowner answers to review on My Tasks',
  jsonb_build_object('reviews', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.reviewed_at) FROM public.homeowner_answer_reviews r), '[]'::jsonb));
DROP FUNCTION public.mark_homeowner_answer_reviewed(uuid, text, timestamptz);
DROP TRIGGER homeowner_answer_reviews_append_only ON public.homeowner_answer_reviews;
DROP FUNCTION private.block_homeowner_answer_review_change();
DROP TABLE public.homeowner_answer_reviews;
