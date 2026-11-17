-- design-review-director: the Director of Onboarding reviews the Designer's work; there is no Lead Designer (Emily, Nov 17).
-- Runs after onboarding-team-cleanup (0353), which moved the Lead Designer reviewer to designer.
-- 1. The step review settings and Task reviews whose reviewer was Lead Designer now name the Director of
--    Onboarding (onboarding_director), never designer: a Designer never reviews their own design work.
-- 2. Live template step names and open Task names that mention Lead Designer now say Director of Onboarding;
--    names that mention the Staging Team now say Stager. Completed Tasks, archived Tasks and saved template
--    versions keep their names. Status, dates and Task history are untouched.
-- Undo: apply.undo.sql (restores every row from the audit row written here).
DO $drd$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  renames constant jsonb := $j${
    "Confirm approval of the design plan/budget with Lead Designer": "Confirm approval of the design plan/budget with the Director of Onboarding",
    "Submit the design for Lead Designer review": "Submit the design for Director of Onboarding review",
    "Confirm with staging team that ROKU tv's were set": "Confirm with the Stager that ROKU tv's were set",
    "Confirm with staging team that ROKU TVs were set up": "Confirm with the Stager that ROKU TVs were set up",
    "Create a Task Summary Sheet for the Staging Team": "Create a Task Summary Sheet for the Stager",
    "Request staging team provide photos of unused decor": "Request the Stager provide photos of unused decor",
    "Ask the staging team about a pre-cleaning": "Ask the Stager about a pre-cleaning",
    "Send the staging instructions and task summary sheet to the staging team": "Send the staging instructions and task summary sheet to the Stager",
    "Purchase curtain panels and have sent to staging team for pressing": "Purchase curtain panels and have sent to the Stager for pressing"
  }$j$::jsonb;
  src jsonb; rev_ids uuid[]; trev_ids uuid[]; task_ids uuid[];
  b_rev jsonb; b_trev jsonb; b_steps jsonb; b_tasks jsonb; b_wi jsonb;
  a_rev jsonb := '[]'; n_rev int := 0; n_trev int; n_steps int; n_tasks int; n_wi int; r record;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  SELECT before_value INTO src FROM public.audit_log
   WHERE action = 'onboarding_team_cleanup.one_designer' ORDER BY created_at DESC LIMIT 1;
  IF src IS NULL THEN RAISE EXCEPTION 'onboarding-team-cleanup is not applied; nothing changed.'; END IF;

  /* 1. Reviewer: Director of Onboarding, not Designer, wherever the reviewer was Lead Designer. */
  SELECT coalesce(array_agg((e->>'id')::uuid), '{}') INTO rev_ids
    FROM jsonb_array_elements(src->'step_review_settings') e WHERE e->'reviewer_roles' ? 'lead_designer';
  SELECT coalesce(array_agg((e->>'id')::uuid), '{}') INTO trev_ids
    FROM jsonb_array_elements(src->'task_reviews') e WHERE e->'reviewer_roles' ? 'lead_designer';

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.template_task_id), '[]') INTO b_rev
    FROM public.onboarding_step_review_settings s WHERE s.template_task_id = ANY(rev_ids) AND 'designer' = ANY(s.reviewer_roles);
  FOR r IN
    UPDATE public.onboarding_step_review_settings s
       SET reviewer_roles = (SELECT array_agg(x ORDER BY o) FROM (
              SELECT CASE WHEN u.rc = 'designer' THEN 'onboarding_director' ELSE u.rc END x, min(u.ord) o
                FROM unnest(s.reviewer_roles) WITH ORDINALITY u(rc, ord) GROUP BY 1) q),
           updated_by = actor, updated_at = now()
     WHERE s.template_task_id = ANY(rev_ids) AND 'designer' = ANY(s.reviewer_roles)
    RETURNING s.template_task_id, to_jsonb(s) AS after
  LOOP
    INSERT INTO public.onboarding_step_review_settings_history(template_task_id, before_value, after_value, changed_by)
    SELECT r.template_task_id, e, r.after, actor FROM jsonb_array_elements(b_rev) e WHERE (e->>'template_task_id')::uuid = r.template_task_id;
    a_rev := a_rev || jsonb_build_array(r.after);
    n_rev := n_rev + 1;
  END LOOP;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'reviewer_roles', to_jsonb(s.reviewer_roles)) ORDER BY s.id), '[]') INTO b_trev
    FROM public.onboarding_task_reviews s WHERE s.id = ANY(trev_ids) AND 'designer' = ANY(s.reviewer_roles);
  UPDATE public.onboarding_task_reviews s
     SET reviewer_roles = (SELECT array_agg(x ORDER BY o) FROM (
            SELECT CASE WHEN u.rc = 'designer' THEN 'onboarding_director' ELSE u.rc END x, min(u.ord) o
              FROM unnest(s.reviewer_roles) WITH ORDINALITY u(rc, ord) GROUP BY 1) q)
   WHERE s.id = ANY(trev_ids) AND 'designer' = ANY(s.reviewer_roles);
  GET DIAGNOSTICS n_trev = ROW_COUNT;

  /* 2. Names. Live template steps; open, not archived Tasks and their linked work. Dates stay as they are. */
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) ORDER BY t.id), '[]') INTO b_steps
    FROM public.onboarding_template_tasks t WHERE renames ? t.title;
  ALTER TABLE public.onboarding_template_tasks DISABLE TRIGGER onboarding_template_tasks_updated_at;
  UPDATE public.onboarding_template_tasks t SET title = renames->>t.title WHERE renames ? t.title;
  GET DIAGNOSTICS n_steps = ROW_COUNT;
  ALTER TABLE public.onboarding_template_tasks ENABLE TRIGGER onboarding_template_tasks_updated_at;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) ORDER BY t.id), '[]'), coalesce(array_agg(t.id), '{}')
    INTO b_tasks, task_ids
    FROM public.onboarding_tasks t WHERE renames ? t.title AND t.status = 'open' AND t.archived_at IS NULL;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title) ORDER BY w.id), '[]') INTO b_wi
    FROM public.work_items w WHERE w.source_table = 'onboarding_tasks' AND w.kind = 'task' AND w.source_id = ANY(task_ids) AND renames ? w.title;
  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items DISABLE TRIGGER work_items_updated;
  UPDATE public.onboarding_tasks t SET title = renames->>t.title WHERE t.id = ANY(task_ids);
  GET DIAGNOSTICS n_tasks = ROW_COUNT;
  UPDATE public.work_items w SET title = renames->>w.title
   WHERE w.source_table = 'onboarding_tasks' AND w.kind = 'task' AND w.source_id = ANY(task_ids) AND renames ? w.title;
  GET DIAGNOSTICS n_wi = ROW_COUNT;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items ENABLE TRIGGER work_items_updated;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'design_review_director.apply', 'functional_role', 'Director of Onboarding',
    'The Director of Onboarding reviews the Designer''s work; there is no Lead Designer. Reviewer moved from Designer to Director of Onboarding where it was Lead Designer; step and open Task names now say Director of Onboarding and Stager. Undo: docs/pending/design-review-director/apply.undo.sql.',
    jsonb_build_object('step_review_settings', b_rev, 'task_reviews', b_trev, 'template_tasks', b_steps, 'tasks', b_tasks, 'work_items', b_wi),
    jsonb_build_object('step_review_settings', n_rev, 'step_review_settings_after', a_rev, 'task_reviews', n_trev,
                       'template_tasks', n_steps, 'tasks', n_tasks, 'work_items', n_wi, 'renames', renames));
END $drd$;
