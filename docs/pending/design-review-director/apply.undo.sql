-- Undo for design-review-director. Restores every changed row from the audit row apply.sql wrote.
-- One transaction; the step review history gets one more row and the undo writes its own audit row.
DO $undo$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  a jsonb; e jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  SELECT before_value INTO a FROM public.audit_log WHERE action = 'design_review_director.apply' ORDER BY created_at DESC LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'design-review-director was not applied; nothing to undo.'; END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(a->'step_review_settings') LOOP
    INSERT INTO public.onboarding_step_review_settings_history(template_task_id, before_value, after_value, changed_by)
    SELECT s.template_task_id, to_jsonb(s), e, actor FROM public.onboarding_step_review_settings s WHERE s.template_task_id = (e->>'template_task_id')::uuid;
    UPDATE public.onboarding_step_review_settings s
       SET reviewer_roles = ARRAY(SELECT jsonb_array_elements_text(e->'reviewer_roles')),
           updated_by = nullif(e->>'updated_by','')::uuid, updated_at = (e->>'updated_at')::timestamptz
     WHERE s.template_task_id = (e->>'template_task_id')::uuid;
  END LOOP;
  UPDATE public.onboarding_task_reviews s SET reviewer_roles = ARRAY(SELECT jsonb_array_elements_text(r->'reviewer_roles'))
    FROM jsonb_array_elements(a->'task_reviews') r WHERE s.id = (r->>'id')::uuid;

  ALTER TABLE public.onboarding_template_tasks DISABLE TRIGGER onboarding_template_tasks_updated_at;
  UPDATE public.onboarding_template_tasks t SET title = r->>'title'
    FROM jsonb_array_elements(a->'template_tasks') r WHERE t.id = (r->>'id')::uuid;
  ALTER TABLE public.onboarding_template_tasks ENABLE TRIGGER onboarding_template_tasks_updated_at;

  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items DISABLE TRIGGER work_items_updated;
  UPDATE public.onboarding_tasks t SET title = r->>'title' FROM jsonb_array_elements(a->'tasks') r WHERE t.id = (r->>'id')::uuid;
  UPDATE public.work_items w SET title = r->>'title' FROM jsonb_array_elements(a->'work_items') r WHERE w.id = (r->>'id')::uuid;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items ENABLE TRIGGER work_items_updated;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'design_review_director.undo', 'functional_role', 'Director of Onboarding',
    'Undo of design-review-director: reviewers and names put back as they were.', NULL, a);
END $undo$;
