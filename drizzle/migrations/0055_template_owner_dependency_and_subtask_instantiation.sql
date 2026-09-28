ALTER TABLE public.onboarding_template_tasks ADD COLUMN IF NOT EXISTS owner_dependency text;
ALTER TABLE public.onboarding_template_tasks ADD CONSTRAINT onboarding_template_tasks_owner_dependency_check
  CHECK (owner_dependency IS NULL OR owner_dependency IN ('none','information','feedback','acknowledge','business_decision'));

CREATE OR REPLACE FUNCTION public.instantiate_onboarding_v2(_project_id uuid, _version_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pr onboarding_projects; snap jsonb; step jsonb; n int := 0; anchor date; who uuid; role text;
  parent_id uuid; sub text; sub_i int; due date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_onboarding_leader(auth.uid()) THEN
    RAISE EXCEPTION 'Only onboarding leadership can start a V2 plan.';
  END IF;
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id;
  SELECT snapshot INTO snap FROM onboarding_template_versions WHERE id=_version_id;
  IF pr.id IS NULL OR snap IS NULL THEN RAISE EXCEPTION 'Project or template version not found.'; END IF;
  FOR step IN SELECT * FROM jsonb_array_elements(snap->'steps') LOOP
    IF coalesce((step->>'is_active')::boolean, true) = false THEN CONTINUE; END IF;
    role := step->>'functional_role';
    who := CASE WHEN role IS NULL THEN NULL ELSE public.project_role_assignee(_project_id, role) END;
    anchor := CASE step->>'schedule_anchor'
      WHEN 'planned_closing' THEN pr.planned_closing_on
      WHEN 'actual_closing' THEN pr.planned_closing_on
      ELSE pr.possession_on END;
    due := CASE WHEN anchor IS NOT NULL AND step->>'offset_days' IS NOT NULL THEN anchor + (step->>'offset_days')::int END;
    INSERT INTO onboarding_tasks(property_id,stage,title,detail,assigned_to,assigned_seat,due_on,status,blocks_handoff,is_required,
      requires_owner_approval,evidence_required,sort_order,schedule_anchor,schedule_offset_days,due_on_source,tags,template_task_id,is_demo,owner_dependency)
    VALUES (pr.property_id, step->>'stage', step->>'title', step->>'detail', who, role, due,
      'open', coalesce((step->>'blocks_handoff')::boolean,false), coalesce((step->>'is_required')::boolean,true),
      coalesce((step->>'requires_owner_approval')::boolean,false), coalesce((step->>'evidence_required')::boolean,false),
      coalesce((step->>'sort_order')::int,0), step->>'schedule_anchor', (step->>'offset_days')::int, 'template_v2',
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(step->'tags','[]'::jsonb)) x),'{}'),
      (step->>'id')::uuid, pr.is_demo, nullif(step->>'owner_dependency','none'))
    RETURNING id INTO parent_id;
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
  UPDATE onboarding_projects SET template_version_id=_version_id WHERE id=_project_id;
  RETURN n;
END $function$;