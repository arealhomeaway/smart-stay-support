-- Undo for 0166 step file links. Restores the live plan-start function exactly,
-- then removes the new link table, RPC, triggers and template column.
-- NOTE: dropping the column/table discards any links saved after 0166 was applied.

CREATE OR REPLACE FUNCTION public.instantiate_onboarding_v2(_project_id uuid, _version_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pr onboarding_projects; snap jsonb; step jsonb; n int := 0; anchor date; who uuid; role text;
  parent_id uuid; sub text; sub_i int; due date; unit text;
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

DROP FUNCTION IF EXISTS public.set_onboarding_task_file_sources(uuid, uuid[]);
DROP TABLE IF EXISTS public.onboarding_task_file_links;
DROP FUNCTION IF EXISTS private.check_task_file_link_home();
DROP TRIGGER IF EXISTS check_template_file_sources ON public.onboarding_template_tasks;
DROP FUNCTION IF EXISTS private.check_template_file_sources();
ALTER TABLE public.onboarding_template_tasks DROP COLUMN IF EXISTS show_files_from;
