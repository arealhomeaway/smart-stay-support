CREATE OR REPLACE FUNCTION public.instantiate_onboarding_v2(_project_id uuid, _version_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pr onboarding_projects; snap jsonb; step jsonb; n int := 0; anchor date; who uuid; role text;
  parent_id uuid; sub text; sub_i int; due date; unit text; created jsonb := '{}'::jsonb; src text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_onboarding_leader(auth.uid()) THEN
    RAISE EXCEPTION 'Only onboarding leadership can start a V2 plan.';
  END IF;
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id;
  SELECT snapshot INTO snap FROM onboarding_template_versions WHERE id=_version_id;
  IF pr.id IS NULL OR snap IS NULL THEN RAISE EXCEPTION 'Project or template version not found.'; END IF;
  FOR step IN SELECT * FROM jsonb_array_elements(snap->'steps') LOOP
    IF coalesce((step->>'is_active')::boolean, true) = false THEN CONTINUE; END IF;
    IF NOT public.plan_step_applies(step->'condition', pr.furnishing_scope, pr.modules) THEN CONTINUE; END IF;
    role := step->>'functional_role';
    who := CASE WHEN role IS NULL THEN NULL ELSE public.project_role_assignee(_project_id, role) END;
    unit := coalesce(step->>'offset_unit','calendar');
    anchor := CASE step->>'schedule_anchor'
      WHEN 'planned_closing' THEN pr.planned_closing_on
      WHEN 'actual_closing' THEN pr.planned_closing_on
      WHEN 'project_created' THEN (pr.created_at AT TIME ZONE 'America/Chicago')::date
      WHEN 'target_handoff' THEN pr.target_handoff_on
      ELSE pr.possession_on END;
    due := public.plan_due_from_rule(anchor, (step->>'offset_days')::int, unit);
    INSERT INTO onboarding_tasks(property_id,stage,title,detail,description,done_when,video_url,assigned_to,assigned_seat,due_on,status,blocks_handoff,is_required,
      requires_owner_approval,evidence_required,sort_order,schedule_anchor,schedule_offset_days,schedule_offset_unit,due_on_source,tags,template_task_id,is_demo,owner_dependency)
    VALUES (pr.property_id, step->>'stage', step->>'title', step->>'detail', step->>'description', step->>'done_when', step->>'video_url', who, role, due,
      'open', coalesce((step->>'blocks_handoff')::boolean,false), coalesce((step->>'is_required')::boolean,true),
      coalesce((step->>'requires_owner_approval')::boolean,false), coalesce((step->>'evidence_required')::boolean,false),
      coalesce((step->>'sort_order')::int,0), step->>'schedule_anchor', (step->>'offset_days')::int, unit, 'template_v2',
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(step->'tags','[]'::jsonb)) x),'{}'),
      (step->>'id')::uuid, pr.is_demo, nullif(step->>'owner_dependency','none'))
    RETURNING id INTO parent_id;
    IF step->>'id' IS NOT NULL THEN created := created || jsonb_build_object(step->>'id', parent_id::text); END IF;
    n := n + 1;
    sub_i := 0;
    FOR sub IN SELECT * FROM jsonb_array_elements_text(coalesce(step->'subtasks','[]'::jsonb)) LOOP
      IF btrim(sub) = '' THEN CONTINUE; END IF;
      sub_i := sub_i + 1;
      INSERT INTO onboarding_tasks(property_id,stage,title,parent_task_id,assigned_to,assigned_seat,due_on,status,blocks_handoff,is_required,
        sort_order,due_on_source,is_demo)
      VALUES (pr.property_id, step->>'stage', btrim(sub), parent_id, who, role, due, 'open',
        coalesce((step->>'blocks_handoff')::boolean,false), coalesce((step->>'is_required')::boolean,true),
        sub_i, 'template_v2', pr.is_demo);
    END LOOP;
  END LOOP;
  -- Step file links: only between Tasks created in this call, so always the same home.
  FOR step IN SELECT * FROM jsonb_array_elements(snap->'steps') LOOP
    IF NOT (created ? (step->>'id')) THEN CONTINUE; END IF;
    FOR src IN SELECT * FROM jsonb_array_elements_text(coalesce(step->'show_files_from','[]'::jsonb)) LOOP
      IF created ? src AND src <> step->>'id' THEN
        INSERT INTO onboarding_task_file_links(property_id, receiving_task_id, source_task_id, origin, created_by)
        VALUES (pr.property_id, (created->>(step->>'id'))::uuid, (created->>src)::uuid, 'template', auth.uid())
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
  UPDATE onboarding_projects SET template_version_id=_version_id WHERE id=_project_id;
  RETURN n;
END $function$
;

CREATE OR REPLACE FUNCTION public.publish_onboarding_template(_template_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v int; new_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_onboarding_leader(auth.uid()) THEN
    RAISE EXCEPTION 'Only onboarding leadership can publish a template.';
  END IF;
  SELECT coalesce(max(version),0)+1 INTO v FROM onboarding_template_versions WHERE template_id=_template_id;
  INSERT INTO onboarding_template_versions(template_id, version, snapshot, published_by)
  SELECT _template_id, v, jsonb_build_object(
    'stages', coalesce((SELECT jsonb_agg(jsonb_build_object('name',s.name,'sort_order',s.sort_order) ORDER BY s.sort_order)
                FROM onboarding_template_stages s WHERE s.template_id=_template_id AND s.active),'[]'::jsonb),
    'steps', coalesce((SELECT jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order)
                FROM onboarding_template_tasks t WHERE t.template_id=_template_id AND t.is_active
                  AND (NOT EXISTS (SELECT 1 FROM onboarding_template_stages s WHERE s.template_id=_template_id)
                       OR EXISTS (SELECT 1 FROM onboarding_template_stages s WHERE s.template_id=_template_id AND s.name=t.stage AND s.active))),'[]'::jsonb)),
    auth.uid()
  RETURNING id INTO new_id;
  RETURN new_id;
END $function$
;
