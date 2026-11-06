-- Approved by Emily Nov 6: move 624 Daniel Court (project e57c1c02-2600-4547-a3a9-cffa541ce4fc) from Standard version 1 to version 3.
-- No BEGIN/COMMIT: the migration tool runs the file in one transaction. Only this home changes.
-- Keeps every completed Task, completion record, note, file, history, assignment and date. Nothing is deleted:
-- steps removed in version 2/3 are archived only when not started; started ones are kept and listed by the precheck notice.
-- New steps get owners from the home's Project Team (unassigned when the role is empty) and the same due rule as instantiate_onboarding_v2.

DO $do$
DECLARE
  _proj constant uuid := 'e57c1c02-2600-4547-a3a9-cffa541ce4fc';
  _prop constant uuid := '2ac3120b-cec9-4735-b4b6-c130bdab63fd';
  _tpl  constant uuid := '84f3a777-44a8-430a-af7e-8f18dc9a7dae';
  _emily constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  v1 uuid; v3 uuid; pr public.onboarding_projects; snap jsonb; step jsonb; who uuid; role text; due date; anchor date;
  parent_id uuid; sub text; sub_i int; new_ids uuid[] := ARRAY['6d24f3a1-7c1e-4c3a-9b2d-000000000a26','6d24f3a1-7c1e-4c3a-9b2d-000000000a58']::uuid[];
  sub_ids uuid[] := ARRAY['6d24f3a1-7c1e-4c3a-9b2d-000000000b01','6d24f3a1-7c1e-4c3a-9b2d-000000000b02','6d24f3a1-7c1e-4c3a-9b2d-000000000b03']::uuid[];
  removed uuid[] := ARRAY['00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f','3505c129-1c91-42db-955b-89c7bce75c11','cbb23216-ee09-4301-b0b0-4392a960a145']::uuid[];
  kept text := ''; r record; n_new int := 0; n_sub int := 0; n_arch int := 0; n_text int := 0;
BEGIN
  SELECT id INTO v1 FROM public.onboarding_template_versions WHERE template_id = _tpl AND version = 1;
  SELECT id, snapshot INTO v3, snap FROM public.onboarding_template_versions WHERE template_id = _tpl AND version = 3;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id = _proj;
  IF v3 IS NULL THEN RAISE EXCEPTION 'Standard version 3 not found; nothing applied'; END IF;
  IF pr.template_version_id IS DISTINCT FROM v1 OR pr.property_id <> _prop THEN RAISE EXCEPTION '624 Daniel Court is not on Standard version 1; nothing applied'; END IF;
  IF (SELECT count(*) FROM public.onboarding_projects WHERE template_version_id = v1) <> 1 THEN RAISE EXCEPTION 'Unexpected homes on Standard version 1; nothing applied'; END IF;
  IF (SELECT count(*) FROM public.onboarding_tasks WHERE property_id = _prop) <> 144
     OR (SELECT count(*) FROM public.onboarding_tasks WHERE property_id = _prop AND status = 'complete') <> 13
     OR (SELECT count(*) FROM public.onboarding_tasks WHERE property_id = _prop AND assigned_to IS NOT NULL) <> 143 THEN
    RAISE EXCEPTION '624 Daniel Court Tasks changed since they were read (expected 144 / 13 complete / 143 assigned); nothing applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_tasks WHERE id = ANY(new_ids || sub_ids)) THEN RAISE EXCEPTION 'New Tasks already exist; nothing applied'; END IF;
  -- The only version 3 steps this home lacks must be the two new ones (the HOA step stays skipped by its module condition)
  IF (SELECT array_agg((e->>'id')::uuid ORDER BY e->>'id') FROM jsonb_array_elements(snap->'steps') e
      WHERE public.plan_step_applies(e->'condition', pr.furnishing_scope, pr.modules)
        AND NOT EXISTS (SELECT 1 FROM public.onboarding_tasks t WHERE t.property_id = _prop AND t.template_task_id = (e->>'id')::uuid))
     IS DISTINCT FROM ARRAY['5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26','5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58']::uuid[] THEN
    RAISE EXCEPTION 'Version 3 differs from the expected new steps for this home; nothing applied'; END IF;

  -- 1. Add the new version 3 steps
  FOR step IN SELECT e FROM jsonb_array_elements(snap->'steps') e
               WHERE e->>'id' IN ('5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26','5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58') ORDER BY (e->>'sort_order')::int LOOP
    role := step->>'functional_role';
    who := CASE WHEN role IS NULL THEN NULL ELSE public.project_role_assignee(_proj, role) END;
    anchor := CASE step->>'schedule_anchor' WHEN 'planned_closing' THEN pr.planned_closing_on WHEN 'actual_closing' THEN pr.planned_closing_on
      WHEN 'project_created' THEN (pr.created_at AT TIME ZONE 'America/Chicago')::date WHEN 'target_handoff' THEN pr.target_handoff_on ELSE pr.possession_on END;
    due := public.plan_due_from_rule(anchor, (step->>'offset_days')::int, coalesce(step->>'offset_unit','calendar'));
    parent_id := CASE step->>'id' WHEN '5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26' THEN new_ids[1] ELSE new_ids[2] END;
    INSERT INTO public.onboarding_tasks(id,property_id,stage,title,detail,description,done_when,video_url,assigned_to,assigned_seat,due_on,status,blocks_handoff,is_required,
      requires_owner_approval,evidence_required,sort_order,schedule_anchor,schedule_offset_days,schedule_offset_unit,due_on_source,tags,template_task_id,is_demo,owner_dependency,created_by)
    VALUES (parent_id, _prop, step->>'stage', step->>'title', step->>'detail', step->>'description', step->>'done_when', step->>'video_url', who, role, due,
      'open', coalesce((step->>'blocks_handoff')::boolean,false), coalesce((step->>'is_required')::boolean,true),
      coalesce((step->>'requires_owner_approval')::boolean,false), coalesce((step->>'evidence_required')::boolean,false),
      coalesce((step->>'sort_order')::int,0), step->>'schedule_anchor', (step->>'offset_days')::int, coalesce(step->>'offset_unit','calendar'), 'template_v2',
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(step->'tags','[]'::jsonb)) x),'{}'),
      (step->>'id')::uuid, pr.is_demo, nullif(step->>'owner_dependency','none'), _emily);
    n_new := n_new + 1;
    sub_i := 0;
    FOR sub IN SELECT * FROM jsonb_array_elements_text(coalesce(step->'subtasks','[]'::jsonb)) LOOP
      IF btrim(sub) = '' THEN CONTINUE; END IF;
      sub_i := sub_i + 1; n_sub := n_sub + 1;
      INSERT INTO public.onboarding_tasks(id,property_id,stage,title,parent_task_id,assigned_to,assigned_seat,due_on,status,blocks_handoff,is_required,sort_order,due_on_source,is_demo,created_by)
      VALUES (sub_ids[n_sub], _prop, step->>'stage', btrim(sub), parent_id, who, role, due, 'open',
        coalesce((step->>'blocks_handoff')::boolean,false), coalesce((step->>'is_required')::boolean,true), sub_i, 'template_v2', pr.is_demo, _emily);
    END LOOP;
  END LOOP;

  -- 2. Steps removed in version 2/3: archive only if not started (open, never completed, no notes, reviews, files, messages, linked work or subtasks)
  FOR r IN SELECT t.* FROM public.onboarding_tasks t WHERE t.property_id = _prop AND t.template_task_id = ANY(removed) AND t.archived_at IS NULL LOOP
    IF r.status = 'open' AND r.completed_at IS NULL AND r.exception_at IS NULL AND r.linked_ticket_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.onboarding_notes WHERE task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_reviews WHERE task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_events WHERE task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_file_links WHERE receiving_task_id = r.id OR source_task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.owner_request_messages WHERE task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.owner_reviews WHERE onboarding_task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.financial_requests WHERE task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.breezeway_outbound_tasks WHERE onboarding_task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE linked_task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.ao_one_off_confirmations WHERE task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.work_items WHERE linked_task_id = r.id OR source_task_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.onboarding_tasks WHERE parent_task_id = r.id OR carryover_of = r.id) THEN
      UPDATE public.onboarding_tasks SET archived_at = now(), archived_by = _emily WHERE id = r.id;
      n_arch := n_arch + 1;
    ELSE
      kept := kept || r.title || '; ';
    END IF;
  END LOOP;

  -- 3. Kati's version 2 wording reaches this home's not-started copies (only where the home still has version 1 wording)
  FOR r IN SELECT t.id, e3 FROM public.onboarding_tasks t
             JOIN jsonb_array_elements(snap->'steps') e3 ON e3->>'id' = t.template_task_id::text
             JOIN public.onboarding_template_versions ov ON ov.id = v1
             JOIN jsonb_array_elements(ov.snapshot->'steps') e1 ON e1->>'id' = t.template_task_id::text
           WHERE t.property_id = _prop AND t.template_task_id IN ('f5b2335f-3aed-44ce-af1a-c119ec66d6c3','36881d78-d434-489b-bf51-fd35022fe2e3')
             AND t.status = 'open' AND t.completed_at IS NULL
             AND t.title = e1->>'title' AND t.detail IS NOT DISTINCT FROM e1->>'detail'
             AND t.done_when IS NOT DISTINCT FROM e1->>'done_when' AND t.description IS NOT DISTINCT FROM e1->>'description' LOOP
    UPDATE public.onboarding_tasks SET title = r.e3->>'title', detail = r.e3->>'detail', done_when = r.e3->>'done_when', description = r.e3->>'description' WHERE id = r.id;
    n_text := n_text + 1;
  END LOOP;

  -- 4. A26 relink: any A26 card on this home's plan points at the new floor plan Task (0 cards today; kept for completeness)
  UPDATE public.ao_home_plan_cards hc SET linked_task_id = new_ids[1]
   WHERE hc.property_id = _prop AND hc.card_id = (SELECT id FROM public.ao_library_cards WHERE code = 'A26');

  -- 5. Move the home and record it in the project history
  UPDATE public.onboarding_projects SET template_version_id = v3 WHERE id = _proj;
  INSERT INTO public.onboarding_project_events(id, project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  VALUES ('6d24f3a1-7c1e-4c3a-9b2d-000000000e01', _proj, _prop, 'template_version_changed', 'Moved to Standard plan version 3',
    format('Added %s steps (%s checklist items), archived %s not-started removed steps, updated wording on %s steps. Kept: %s', n_new, n_sub, n_arch, n_text, coalesce(nullif(kept,''),'none')),
    v1::text, v3::text, _emily, pr.is_demo);
  IF n_new <> 2 OR n_text <> 2 THEN RAISE EXCEPTION 'Unexpected counts (new %, wording %); nothing applied', n_new, n_text; END IF;
  RAISE NOTICE 'Daniel Court moved to v3: new %, subtasks %, archived %, wording %, kept: %', n_new, n_sub, n_arch, n_text, coalesce(nullif(kept,''),'none');
END $do$;
