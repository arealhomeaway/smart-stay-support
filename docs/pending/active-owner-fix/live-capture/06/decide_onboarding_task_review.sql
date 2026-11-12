CREATE OR REPLACE FUNCTION public.decide_onboarding_task_review(_review_id uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _actor uuid := auth.uid(); rv public.onboarding_task_reviews; t public.onboarding_tasks; mine text[]; r text; remaining integer;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Sign in to review.'; END IF;
  IF _decision NOT IN ('approved','sent_back') THEN RAISE EXCEPTION 'Choose Approve or Send back.'; END IF;
  SELECT * INTO rv FROM public.onboarding_task_reviews WHERE id = _review_id FOR UPDATE;
  IF NOT FOUND OR rv.status <> 'pending' THEN RAISE EXCEPTION 'This review is no longer waiting.'; END IF;
  SELECT coalesce(array_agg(x), '{}') INTO mine FROM unnest(rv.reviewer_roles) x
    WHERE private.review_role_person(rv.project_id, x) = _actor
      AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x);
  IF cardinality(mine) = 0 THEN RAISE EXCEPTION 'Only the assigned reviewer can do this.'; END IF;
  IF _decision = 'sent_back' AND length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Add a note saying what needs to change.'; END IF;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = rv.task_id FOR UPDATE;
  FOREACH r IN ARRAY mine LOOP
    INSERT INTO public.onboarding_task_review_decisions(review_id, role_code, reviewer_id, decision, note)
    VALUES (rv.id, r, _actor, _decision, nullif(trim(coalesce(_note,'')),''));
    INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, role_code, note)
    VALUES (rv.task_id, rv.id, _decision, _actor, r, nullif(trim(coalesce(_note,'')),''));
  END LOOP;
  IF _decision = 'sent_back' THEN
    UPDATE public.onboarding_task_reviews SET status = 'changes_requested', closed_at = now() WHERE id = rv.id;
    PERFORM private.review_notify(ARRAY[coalesce(t.assigned_to, rv.submitted_by)], _actor, 'onboarding_review_changes', 'Changes requested: '||t.title,
      trim(_note), t.id, t.property_id, t.is_demo);
    RETURN jsonb_build_object('status', 'changes_requested');
  END IF;
  SELECT count(*) INTO remaining FROM unnest(rv.reviewer_roles) x
    WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x AND d.decision = 'approved');
  IF remaining > 0 THEN RETURN jsonb_build_object('status', 'pending', 'remaining', remaining); END IF;
  UPDATE public.onboarding_task_reviews SET status = 'approved', closed_at = now() WHERE id = rv.id;
  INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id) VALUES (rv.task_id, rv.id, 'review_complete', _actor);
  IF t.status <> 'complete' THEN
    UPDATE public.onboarding_tasks SET status = 'complete', completed_at = now(), completed_by = coalesce(rv.submitted_by, _actor), blocker = NULL WHERE id = t.id;
  END IF;
  RETURN jsonb_build_object('status', 'approved');
END $function$
;
