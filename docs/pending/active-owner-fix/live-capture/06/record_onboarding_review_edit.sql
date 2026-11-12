CREATE OR REPLACE FUNCTION public.record_onboarding_review_edit(_review_id uuid, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _actor uuid := auth.uid(); rv public.onboarding_task_reviews;
BEGIN
  SELECT * INTO rv FROM public.onboarding_task_reviews WHERE id = _review_id;
  IF _actor IS NULL OR NOT FOUND OR rv.status <> 'pending' THEN RAISE EXCEPTION 'This review is no longer waiting.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(rv.reviewer_roles) x WHERE private.review_role_person(rv.project_id, x) = _actor) THEN
    RAISE EXCEPTION 'Only the assigned reviewer can do this.';
  END IF;
  IF length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Say what you changed.'; END IF;
  INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, note) VALUES (rv.task_id, rv.id, 'edited', _actor, trim(_note));
END $function$
;
