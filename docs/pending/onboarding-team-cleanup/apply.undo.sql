-- Undo for onboarding-team-cleanup. Restores every changed row from the audit rows apply.sql wrote,
-- removes what it added, and puts back the original functions. One transaction; writes its own audit row.
DO $undo$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  a jsonb; a_at timestamptz; c jsonb; x jsonb; s jsonb; vid uuid; step_idx int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  SELECT before_value, created_at INTO a, a_at FROM public.audit_log
   WHERE action = 'onboarding_team_cleanup.one_designer' ORDER BY created_at DESC LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'onboarding-team-cleanup was not applied; nothing to undo.'; END IF;
  SELECT after_value INTO c FROM public.audit_log
   WHERE action = 'onboarding_team_cleanup.assem_please' ORDER BY created_at DESC LIMIT 1;

  -- Part 3
  IF c IS NOT NULL THEN
    vid := (c->>'vendor_org_id')::uuid;
    DELETE FROM public.onboarding_project_events
     WHERE project_id = (c->>'comstock_project_id')::uuid AND kind = 'stagers_changed' AND created_at = a_at AND new_value = vid::text;
    DELETE FROM public.onboarding_project_stagers
     WHERE project_id = (c->>'comstock_project_id')::uuid AND vendor_org_id = vid AND added_at = a_at;
    IF (c->>'vendor_created')::boolean THEN
      DELETE FROM public.vendor_orgs WHERE id = vid AND created_at = a_at;
    END IF;
  END IF;

  -- Part 1: pool members
  DELETE FROM public.functional_role_members WHERE role_code = 'designer' AND added_by = actor AND created_at = a_at;
  INSERT INTO public.functional_role_members(id, role_code, user_id, added_by, created_at)
  SELECT (m->>'id')::uuid, m->>'role_code', (m->>'user_id')::uuid, nullif(m->>'added_by','')::uuid, (m->>'created_at')::timestamptz
    FROM jsonb_array_elements(a->'pool_members') m
  ON CONFLICT DO NOTHING;
  -- roles
  UPDATE public.functional_roles f SET active = (r->>'active')::boolean
    FROM jsonb_array_elements(a->'roles') r WHERE f.code = r->>'code' AND f.active IS DISTINCT FROM (r->>'active')::boolean;
  -- home teams
  UPDATE public.onboarding_projects p SET role_assignments = r->'role_assignments'
    FROM jsonb_array_elements(a->'role_assignments') r WHERE p.id = (r->>'id')::uuid;
  -- template steps
  UPDATE public.onboarding_template_tasks t SET functional_role = r->>'functional_role', role = r->>'role'
    FROM jsonb_array_elements(a->'template_tasks') r WHERE t.id = (r->>'id')::uuid;
  -- published versions: each changed step goes back byte for byte
  ALTER TABLE public.onboarding_template_versions DISABLE TRIGGER block_template_version_mutation;
  FOR x IN SELECT * FROM jsonb_array_elements(a->'version_steps') LOOP
    UPDATE public.onboarding_template_versions v
       SET snapshot = jsonb_set(v.snapshot, ARRAY['steps', x->>'i'], x->'step')
     WHERE v.id = (x->>'version_id')::uuid AND v.snapshot->'steps'->((x->>'i')::int)->>'id' IS NOT DISTINCT FROM x->>'step_id';
  END LOOP;
  ALTER TABLE public.onboarding_template_versions ENABLE TRIGGER block_template_version_mutation;
  -- Tasks and work items, with their dates untouched
  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items DISABLE TRIGGER work_items_updated;
  UPDATE public.onboarding_tasks t SET assigned_seat = r->>'assigned_seat'
    FROM jsonb_array_elements(a->'tasks') r WHERE t.id = (r->>'id')::uuid;
  UPDATE public.work_items w SET functional_role = r->>'functional_role'
    FROM jsonb_array_elements(a->'work_items') r WHERE w.id = (r->>'id')::uuid;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items ENABLE TRIGGER work_items_updated;
  -- step reviewers
  UPDATE public.onboarding_step_review_settings s2 SET reviewer_roles = ARRAY(SELECT jsonb_array_elements_text(r->'reviewer_roles'))
    FROM jsonb_array_elements(a->'step_review_settings') r WHERE s2.template_task_id = (r->>'id')::uuid;
  UPDATE public.onboarding_task_reviews s2 SET reviewer_roles = ARRAY(SELECT jsonb_array_elements_text(r->'reviewer_roles'))
    FROM jsonb_array_elements(a->'task_reviews') r WHERE s2.id = (r->>'id')::uuid;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
  VALUES (actor, 'Admin', 'onboarding_team_cleanup.undone', 'functional_role', 'Designer and Stager',
    'Undo of onboarding-team-cleanup: every moved row restored from its audit row; Assem Please link removed.');
END $undo$;

DROP INDEX IF EXISTS public.onboarding_project_stagers_one_live;


-- Original role checks back. Each function is patched back from its live definition; a definition
-- that does not read exactly as apply.sql left it stops the whole undo. Bodies: functions-before.sql.
DO $fn$
DECLARE p record; d text; hits int;
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('public.bulk_update_onboarding_home_tasks(uuid,uuid[],boolean,date,boolean,text,boolean,text,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure,
     $n$    'lead_designer', 'designer', 'staging_team', 'design_staging', 'director_ops', 'property_coordinator'$n$,
     $o$    'designer', 'director_ops', 'property_coordinator'$o$),
    ('public.bulk_update_onboarding_template_steps(uuid,uuid[],boolean,integer,text,boolean,text,boolean,text,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure,
     $n$      'lead_designer', 'designer', 'staging_team', 'design_staging', 'director_ops', 'property_coordinator'$n$,
     $o$      'designer', 'director_ops', 'property_coordinator'$o$),
    ('public.bulk_update_onboarding_template_steps(uuid,uuid[],boolean,integer,text,boolean,text,boolean,text,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure,
     $n$      WHEN 'lead_designer' THEN 'Lead Designer'
      WHEN 'designer' THEN 'Designer'
      WHEN 'staging_team' THEN 'Staging Team'
      WHEN 'design_staging' THEN 'Design & Staging (older steps)'
$n$,
     $o$      WHEN 'designer' THEN 'Designer'
$o$),
    ('public.plan_catch_up_tasks(uuid,uuid[],text,text,text,uuid,date,boolean)'::regprocedure,
     $n$'onboarding_project_manager', 'utilities', 'lead_designer', 'designer', 'staging_team']) THEN$n$,
     $o$'onboarding_project_manager', 'utilities', 'designer']) THEN$o$),
    ('private.review_role_person(uuid,text)'::regprocedure,
     $n$CASE WHEN _role IN ('lead_designer','onboarding_manager')$n$,
     $o$CASE WHEN _role IN ('designer','onboarding_manager')$o$),
    ('public.set_onboarding_project_stagers(uuid,uuid[])'::regprocedure,
     $n$  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
$n$,
     $o$  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  -- One Stager per home (Nov 17).
  IF (SELECT count(DISTINCT v) FROM unnest(wanted) v) > 1 THEN RAISE EXCEPTION 'A home has one stager.'; END IF;
$o$)
  ) v(fn, new_text, old_text) LOOP
    d := pg_get_functiondef(p.fn);
    hits := (length(d) - length(replace(d, p.old_text, ''))) / length(p.old_text);
    IF hits <> 1 THEN RAISE EXCEPTION 'Function % does not read as expected (% matches); nothing applied.', p.fn, hits; END IF;
    EXECUTE replace(d, p.old_text, p.new_text);
  END LOOP;
END $fn$;
