-- onboarding-team-cleanup: one Designer, one Stager per home (business rule confirmed by the Director of Onboarding, Nov 17).
-- Part 1: lead_designer and design_staging become designer everywhere a role is stored.
-- Part 2: staging_team is retired from every role list; the Stager is one vendor per home.
-- Part 3: adds the vendor Assem Please and sets it as the Stager on 8738 Comstock Ct.
-- The file category design_staging ("Staging instructions") is a document type and is not touched.
-- Who can see and do what is unchanged: no policy, grant or permission helper changes.
-- Undo: apply.undo.sql (restores every row from the audit rows written here, and the old functions).
DO $otc$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  old_codes constant text[] := ARRAY['lead_designer','design_staging'];
  old_labels constant text[] := ARRAY['Lead Designer','Design & Staging','Design & Staging (older steps)'];
  comstock constant uuid := '5aa876df-fd59-41af-9e39-b528d51fdc74';
  notion_hex constant text := '4174658d5f4f8093a9fff46dac51e96e';
  b_pool jsonb; b_roles jsonb; b_ra jsonb; b_tmpl jsonb; b_snap jsonb; b_tasks jsonb; b_wi jsonb; b_rev jsonb; b_trev jsonb;
  conflicts jsonb; staging_steps jsonb; staging_snap jsonb;
  n_pool_added int; n_pool_removed int; n_roles int; n_ra int; n_tmpl int; n_snap int; n_tasks int; n_wi int; n_rev int; n_trev int;
  v_vendor uuid; v_created boolean := false; b_stager jsonb;
BEGIN
  -- Project and role-seat guards need a signed-in Admin; act as the Admin for this transaction only.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  /* ---------------- Part 1: one Designer ---------------- */
  -- Role pool members: merged into designer, no duplicates.
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.role_code, m.user_id), '[]') INTO b_pool
    FROM public.functional_role_members m WHERE m.role_code = ANY(old_codes);
  INSERT INTO public.functional_role_members(role_code, user_id, added_by)
  SELECT DISTINCT 'designer', m.user_id, actor FROM public.functional_role_members m WHERE m.role_code = ANY(old_codes)
  ON CONFLICT (role_code, user_id) DO NOTHING;
  GET DIAGNOSTICS n_pool_added = ROW_COUNT;
  DELETE FROM public.functional_role_members WHERE role_code = ANY(old_codes);
  GET DIAGNOSTICS n_pool_removed = ROW_COUNT;

  -- The three retired roles leave every role list (kept, switched off, never deleted).
  SELECT coalesce(jsonb_agg(jsonb_build_object('code', code, 'active', active) ORDER BY code), '[]') INTO b_roles
    FROM public.functional_roles WHERE code IN ('lead_designer','design_staging','staging_team');
  UPDATE public.functional_roles SET active = false WHERE code IN ('lead_designer','design_staging','staging_team') AND active;
  GET DIAGNOSTICS n_roles = ROW_COUNT;

  -- Project role assignments: one designer key; the lead_designer person wins a conflict.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'role_assignments', p.role_assignments) ORDER BY p.id), '[]') INTO b_ra
    FROM public.onboarding_projects p WHERE p.role_assignments ?| old_codes;
  SELECT coalesce(jsonb_agg(jsonb_build_object('project_id', p.id, 'property_id', p.property_id, 'kept', p.role_assignments->>'lead_designer',
           'role_assignments', p.role_assignments) ORDER BY p.id), '[]') INTO conflicts
    FROM public.onboarding_projects p
   WHERE p.role_assignments ?| old_codes
     AND (SELECT count(DISTINCT e.value) FROM jsonb_each_text(p.role_assignments) e
           WHERE e.key IN ('lead_designer','designer','design_staging') AND coalesce(e.value,'') <> '') > 1;
  UPDATE public.onboarding_projects p
     SET role_assignments = (p.role_assignments - 'lead_designer' - 'design_staging')
         || jsonb_strip_nulls(jsonb_build_object('designer', coalesce(nullif(p.role_assignments->>'lead_designer',''),
                                                                     nullif(p.role_assignments->>'designer',''),
                                                                     nullif(p.role_assignments->>'design_staging',''))))
   WHERE p.role_assignments ?| old_codes;
  GET DIAGNOSTICS n_ra = ROW_COUNT;

  -- Template steps (live rows).
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'functional_role', t.functional_role, 'role', t.role) ORDER BY t.id), '[]') INTO b_tmpl
    FROM public.onboarding_template_tasks t WHERE t.functional_role = ANY(old_codes) OR t.role = ANY(old_labels);
  UPDATE public.onboarding_template_tasks t
     SET functional_role = CASE WHEN t.functional_role = ANY(old_codes) THEN 'designer' ELSE t.functional_role END,
         role = 'Designer'
   WHERE t.functional_role = ANY(old_codes) OR t.role = ANY(old_labels);
  GET DIAGNOSTICS n_tmpl = ROW_COUNT;

  -- Template steps in every published version (the version lock is lifted for this change only).
  SELECT coalesce(jsonb_agg(jsonb_build_object('version_id', v.id, 'step_id', e.step->>'id', 'i', e.ord - 1, 'step', e.step)
           ORDER BY v.id, e.ord), '[]') INTO b_snap
    FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY e(step, ord)
   WHERE e.step->>'functional_role' = ANY(old_codes) OR e.step->>'role' = ANY(old_labels);
  ALTER TABLE public.onboarding_template_versions DISABLE TRIGGER block_template_version_mutation;
  UPDATE public.onboarding_template_versions v
     SET snapshot = jsonb_set(v.snapshot, '{steps}', (
       SELECT jsonb_agg(CASE WHEN e.step->>'functional_role' = ANY(old_codes) OR e.step->>'role' = ANY(old_labels)
                             THEN e.step || jsonb_build_object('role', 'Designer')
                                  || CASE WHEN e.step->>'functional_role' = ANY(old_codes) THEN jsonb_build_object('functional_role', 'designer') ELSE '{}'::jsonb END
                             ELSE e.step END ORDER BY e.ord)
         FROM jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY e(step, ord)))
   WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(v.snapshot->'steps') s
                  WHERE s->>'functional_role' = ANY(old_codes) OR s->>'role' = ANY(old_labels));
  GET DIAGNOSTICS n_snap = ROW_COUNT;
  ALTER TABLE public.onboarding_template_versions ENABLE TRIGGER block_template_version_mutation;

  -- Onboarding Tasks and their work items: role only. Status, dates (including updated_at) and history stay as they are.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'assigned_seat', t.assigned_seat) ORDER BY t.id), '[]') INTO b_tasks
    FROM public.onboarding_tasks t WHERE t.assigned_seat = ANY(old_codes);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'functional_role', w.functional_role) ORDER BY w.id), '[]') INTO b_wi
    FROM public.work_items w WHERE w.functional_role = ANY(old_codes);
  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks DISABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items DISABLE TRIGGER work_items_updated;
  UPDATE public.onboarding_tasks SET assigned_seat = 'designer' WHERE assigned_seat = ANY(old_codes);
  GET DIAGNOSTICS n_tasks = ROW_COUNT;
  UPDATE public.work_items SET functional_role = 'designer' WHERE functional_role = ANY(old_codes);
  GET DIAGNOSTICS n_wi = ROW_COUNT;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER onboarding_tasks_updated;
  ALTER TABLE public.onboarding_tasks ENABLE TRIGGER sync_onboarding_work_item;
  ALTER TABLE public.work_items ENABLE TRIGGER work_items_updated;

  -- Step review reviewers name the role too.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.template_task_id, 'reviewer_roles', to_jsonb(s.reviewer_roles)) ORDER BY s.template_task_id), '[]') INTO b_rev
    FROM public.onboarding_step_review_settings s WHERE s.reviewer_roles && old_codes;
  UPDATE public.onboarding_step_review_settings s
     SET reviewer_roles = (SELECT array_agg(x ORDER BY o) FROM (
            SELECT CASE WHEN u.rc = ANY(old_codes) THEN 'designer' ELSE u.rc END x, min(u.ord) o
              FROM unnest(s.reviewer_roles) WITH ORDINALITY u(rc, ord) GROUP BY 1) q)
   WHERE s.reviewer_roles && old_codes;
  GET DIAGNOSTICS n_rev = ROW_COUNT;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'reviewer_roles', to_jsonb(s.reviewer_roles)) ORDER BY s.id), '[]') INTO b_trev
    FROM public.onboarding_task_reviews s WHERE s.reviewer_roles && old_codes;
  UPDATE public.onboarding_task_reviews s
     SET reviewer_roles = (SELECT array_agg(x ORDER BY o) FROM (
            SELECT CASE WHEN u.rc = ANY(old_codes) THEN 'designer' ELSE u.rc END x, min(u.ord) o
              FROM unnest(s.reviewer_roles) WITH ORDINALITY u(rc, ord) GROUP BY 1) q)
   WHERE s.reviewer_roles && old_codes;
  GET DIAGNOSTICS n_trev = ROW_COUNT;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'onboarding_team_cleanup.one_designer', 'functional_role', 'Designer',
    'One Designer per home: lead_designer and design_staging moved to designer (role pools, home teams, template steps in every version, Tasks, work items, step reviewers). Undo: docs/pending/onboarding-team-cleanup/apply.undo.sql.',
    jsonb_build_object('pool_members', b_pool, 'roles', b_roles, 'role_assignments', b_ra, 'template_tasks', b_tmpl,
                       'version_steps', b_snap, 'tasks', b_tasks, 'work_items', b_wi, 'step_review_settings', b_rev, 'task_reviews', b_trev),
    jsonb_build_object('pool_members_added', n_pool_added, 'pool_members_removed', n_pool_removed, 'roles_switched_off', n_roles,
                       'homes', n_ra, 'template_tasks', n_tmpl, 'versions', n_snap, 'version_steps', jsonb_array_length(b_snap),
                       'tasks', n_tasks, 'work_items', n_wi, 'step_review_settings', n_rev, 'task_reviews', n_trev,
                       'conflicting_homes', conflicts));

  /* ---------------- Part 2: one Stager ---------------- */
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'template_id', t.template_id, 'title', t.title) ORDER BY t.id), '[]') INTO staging_steps
    FROM public.onboarding_template_tasks t WHERE t.functional_role = 'staging_team';
  SELECT coalesce(jsonb_agg(jsonb_build_object('version_id', v.id, 'title', e->>'title')), '[]') INTO staging_snap
    FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e WHERE e->>'functional_role' = 'staging_team';
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'onboarding_team_cleanup.one_stager', 'functional_role', 'Stager',
    'One Stager per home, picked from the vendor database: Staging Team role switched off and removed from every role list; one live stager per home; the free-text staging provider stays in the database and is no longer shown or saved. No home''s stager changed.',
    jsonb_build_object('live_stagers', (SELECT coalesce(jsonb_agg(jsonb_build_object('project_id', project_id, 'vendor_org_id', vendor_org_id)), '[]')
                                          FROM public.onboarding_project_stagers WHERE removed_at IS NULL),
                       'staging_team_tasks', (SELECT count(*) FROM public.onboarding_tasks WHERE assigned_seat = 'staging_team'),
                       'staging_team_pool', (SELECT count(*) FROM public.functional_role_members WHERE role_code = 'staging_team')),
    jsonb_build_object('template_steps_left_on_staging_team', staging_steps, 'version_steps_left_on_staging_team', staging_snap));

  /* ---------------- Part 3: Assem Please, Stager on 8738 Comstock Ct ---------------- */
  SELECT o.id INTO v_vendor FROM public.vendor_orgs o
   WHERE replace(lower(coalesce(o.legacy_notion_id, '')), '-', '') LIKE '%' || notion_hex || '%' LIMIT 1;
  IF v_vendor IS NULL THEN
    INSERT INTO public.vendor_orgs(legal_name, display_name, status, primary_contact_name, primary_contact_email,
                                   service_categories, markets, source_system, migration_status, legacy_notion_id, created_by)
    VALUES ('Assem Please', 'Assem Please', 'candidate', 'Damon Jones', 'djones@assemplease.com',
            ARRAY['Staging','Make Ready'], ARRAY['Indy'], 'notion', 'imported_needs_review',
            'https://app.notion.com/' || notion_hex, actor)
    RETURNING id INTO v_vendor;
    v_created := true;
  END IF;
  SELECT coalesce(jsonb_agg(vendor_org_id), '[]') INTO b_stager FROM public.onboarding_project_stagers WHERE project_id = comstock AND removed_at IS NULL;
  IF jsonb_array_length(b_stager) > 0 AND NOT b_stager @> to_jsonb(ARRAY[v_vendor]) THEN
    RAISE EXCEPTION '8738 Comstock Ct already has a different stager; nothing applied.';
  END IF;
  IF jsonb_array_length(b_stager) = 0 THEN
    INSERT INTO public.onboarding_project_stagers(project_id, vendor_org_id, added_by) VALUES (comstock, v_vendor, actor);
    INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, prior_value, new_value, actor, is_demo)
    SELECT p.id, p.property_id, 'stagers_changed', 'Stager changed', '', v_vendor::text, actor, coalesce(p.is_demo, false)
      FROM public.onboarding_projects p WHERE p.id = comstock;
  END IF;
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'onboarding_team_cleanup.assem_please', 'vendor_org', v_vendor, 'Assem Please',
    'Vendor Assem Please (Notion 4174658d-5f4f-8093-a9ff-f46dac51e96e) and Stager on 8738 Comstock Ct.',
    jsonb_build_object('comstock_stagers', b_stager),
    jsonb_build_object('vendor_created', v_created, 'vendor_org_id', v_vendor, 'comstock_project_id', comstock));
END $otc$;

-- Part 2: one live Stager per home, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_project_stagers_one_live ON public.onboarding_project_stagers(project_id) WHERE removed_at IS NULL;

-- Role checks: the retired codes leave every allowed-value list. Each function is patched in
-- place from its live definition; a definition that does not read exactly as expected stops the
-- whole change. Full before and after bodies: functions-before.sql and functions-after.sql.
DO $fn$
DECLARE p record; d text; hits int;
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('public.bulk_update_onboarding_home_tasks(uuid,uuid[],boolean,date,boolean,text,boolean,text,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure,
     $o$    'lead_designer', 'designer', 'staging_team', 'design_staging', 'director_ops', 'property_coordinator'$o$,
     $n$    'designer', 'director_ops', 'property_coordinator'$n$),
    ('public.bulk_update_onboarding_template_steps(uuid,uuid[],boolean,integer,text,boolean,text,boolean,text,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure,
     $o$      'lead_designer', 'designer', 'staging_team', 'design_staging', 'director_ops', 'property_coordinator'$o$,
     $n$      'designer', 'director_ops', 'property_coordinator'$n$),
    ('public.bulk_update_onboarding_template_steps(uuid,uuid[],boolean,integer,text,boolean,text,boolean,text,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure,
     $o$      WHEN 'lead_designer' THEN 'Lead Designer'
      WHEN 'designer' THEN 'Designer'
      WHEN 'staging_team' THEN 'Staging Team'
      WHEN 'design_staging' THEN 'Design & Staging (older steps)'
$o$,
     $n$      WHEN 'designer' THEN 'Designer'
$n$),
    ('public.plan_catch_up_tasks(uuid,uuid[],text,text,text,uuid,date,boolean)'::regprocedure,
     $o$'onboarding_project_manager', 'utilities', 'lead_designer', 'designer', 'staging_team']) THEN$o$,
     $n$'onboarding_project_manager', 'utilities', 'designer']) THEN$n$),
    ('private.review_role_person(uuid,text)'::regprocedure,
     $o$CASE WHEN _role IN ('lead_designer','onboarding_manager')$o$,
     $n$CASE WHEN _role IN ('designer','onboarding_manager')$n$),
    ('public.set_onboarding_project_stagers(uuid,uuid[])'::regprocedure,
     $o$  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
$o$,
     $n$  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  -- One Stager per home (Nov 17).
  IF (SELECT count(DISTINCT v) FROM unnest(wanted) v) > 1 THEN RAISE EXCEPTION 'A home has one stager.'; END IF;
$n$)
  ) v(fn, old_text, new_text) LOOP
    d := pg_get_functiondef(p.fn);
    hits := (length(d) - length(replace(d, p.old_text, ''))) / length(p.old_text);
    IF hits <> 1 THEN RAISE EXCEPTION 'Function % does not read as expected (% matches); nothing applied.', p.fn, hits; END IF;
    EXECUTE replace(d, p.old_text, p.new_text);
  END LOOP;
END $fn$;
