-- homeowner-answer-review (Nov 22): Reviewed for homeowner answers under My homeowners on My Tasks.
-- One transaction, additive. New append-only record of reviews and one caller-authenticated action.
-- Nothing existing is changed: no Task, card, owner item, approval, notice, email or permission.
DO $guard$
BEGIN
  IF to_regclass('public.homeowner_answer_reviews') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'mark_homeowner_answer_reviewed') THEN
    RAISE EXCEPTION 'homeowner-answer-review: already applied';
  END IF;
END $guard$;

-- 1. One row per review of one answer. item_key names the answer: card:, review:, approval: or update:
-- and its id. answer_at is the answer's latest time when it was reviewed, so a newer answer from the
-- homeowner is not covered and returns to the review list. Rows are never changed or removed.
CREATE TABLE public.homeowner_answer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  item_key text NOT NULL CHECK (item_key ~ '^(card|review|approval|update):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  answer_at timestamptz NOT NULL,
  reviewed_by uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homeowner_answer_reviews_once UNIQUE (item_key, answer_at)
);
COMMENT ON TABLE public.homeowner_answer_reviews IS
  'Append-only: who marked a homeowner answer reviewed on My Tasks, and when (Nov 22). Written only by mark_homeowner_answer_reviewed.';
CREATE INDEX homeowner_answer_reviews_home ON public.homeowner_answer_reviews (property_id, item_key);
GRANT SELECT ON public.homeowner_answer_reviews TO authenticated;
GRANT ALL ON public.homeowner_answer_reviews TO service_role;
ALTER TABLE public.homeowner_answer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read homeowner answer reviews" ON public.homeowner_answer_reviews
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

CREATE FUNCTION private.block_homeowner_answer_review_change()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  RAISE EXCEPTION 'Reviews are kept as history and cannot be changed.';
END $function$;
REVOKE ALL ON FUNCTION private.block_homeowner_answer_review_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER homeowner_answer_reviews_append_only BEFORE UPDATE OR DELETE ON public.homeowner_answer_reviews
  FOR EACH ROW EXECUTE FUNCTION private.block_homeowner_answer_review_change();

-- 2. Reviewed. The home's assigned Project Manager; the Director of Onboarding and Admin cover.
-- The answer must belong to that home. Pressing twice for the same answer saves one review.
CREATE FUNCTION public.mark_homeowner_answer_reviewed(_property_id uuid, _item_key text, _answer_at timestamptz)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _pm uuid;
  _kind text := split_part(coalesce(_item_key, ''), ':', 1);
  _id uuid;
  _found boolean;
  _row public.homeowner_answer_reviews;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  IF _item_key IS NULL OR _item_key !~ '^(card|review|approval|update):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'That homeowner answer was not found.';
  END IF;
  _id := split_part(_item_key, ':', 2)::uuid;
  SELECT project_manager INTO _pm FROM public.onboarding_projects
   WHERE property_id = _property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF NOT ((_pm IS NOT NULL AND _pm = _me) OR public.is_onboarding_director(_me) OR private.has_role(_me, 'admin')) THEN
    RAISE EXCEPTION 'Only this home''s Project Manager can mark homeowner answers reviewed.';
  END IF;
  IF _answer_at IS NULL OR _answer_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'That answer time is not valid.';
  END IF;
  _found := CASE _kind
    WHEN 'card' THEN EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE id = _id AND property_id = _property_id)
    WHEN 'review' THEN EXISTS (SELECT 1 FROM public.owner_reviews r WHERE r.id = _id AND (r.property_id = _property_id
         OR EXISTS (SELECT 1 FROM public.owner_review_properties x WHERE x.review_id = r.id AND x.property_id = _property_id)
         OR EXISTS (SELECT 1 FROM public.owner_program_properties pp WHERE pp.program_id = r.program_id AND pp.property_id = _property_id)
         OR EXISTS (SELECT 1 FROM public.owner_programs op WHERE op.id = r.program_id AND op.property_id = _property_id)))
    WHEN 'approval' THEN EXISTS (SELECT 1 FROM public.approvals WHERE id = _id AND property_id = _property_id)
    WHEN 'update' THEN EXISTS (SELECT 1 FROM public.homeowner_updates WHERE id = _id AND property_id = _property_id)
    ELSE false END;
  IF NOT _found THEN RAISE EXCEPTION 'That homeowner answer was not found on this home.'; END IF;

  INSERT INTO public.homeowner_answer_reviews(property_id, item_key, answer_at, reviewed_by)
  VALUES (_property_id, _item_key, _answer_at, _me)
  ON CONFLICT ON CONSTRAINT homeowner_answer_reviews_once DO NOTHING
  RETURNING * INTO _row;
  IF _row.id IS NULL THEN
    SELECT * INTO _row FROM public.homeowner_answer_reviews WHERE item_key = _item_key AND answer_at = _answer_at;
    RETURN jsonb_build_object('ok', true, 'already', true, 'reviewed_by', _row.reviewed_by, 'reviewed_at', _row.reviewed_at);
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (_me, 'homeowner_answer.reviewed', 'property', _property_id, _item_key,
          jsonb_build_object('item_key', _item_key, 'answer_at', _answer_at, 'review_id', _row.id));
  RETURN jsonb_build_object('ok', true, 'already', false, 'reviewed_by', _me, 'reviewed_at', _row.reviewed_at);
END $function$;
REVOKE ALL ON FUNCTION public.mark_homeowner_answer_reviewed(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_homeowner_answer_reviewed(uuid, text, timestamptz) TO authenticated;

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
VALUES (NULL, 'homeowner_answer_review.apply', 'function', NULL, 'Homeowner answers to review on My Tasks',
  jsonb_build_object('table', 'homeowner_answer_reviews', 'function', 'mark_homeowner_answer_reviewed'));
