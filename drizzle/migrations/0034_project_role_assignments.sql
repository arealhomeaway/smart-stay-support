ALTER TABLE public.onboarding_projects ADD COLUMN IF NOT EXISTS role_assignments jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.onboarding_projects.role_assignments IS 'Project Team: functional_role code -> assigned user id, for roles without a dedicated column. PM uses project_manager, Utilities uses utility_manager.';

CREATE OR REPLACE FUNCTION public.project_role_assignee(_project_id uuid, _role text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'onboarding_project_manager' THEN p.project_manager
    WHEN 'utilities' THEN p.utility_manager
    WHEN 'onboarding_director' THEN coalesce(p.director, public.seat_holder('onboarding_director'))
    WHEN 'owner' THEN NULL
    ELSE coalesce(
      nullif(p.role_assignments->>_role,'')::uuid,
      CASE WHEN EXISTS (SELECT 1 FROM public.functional_roles f WHERE f.code=_role AND f.team='onboarding')
           THEN NULL ELSE public.seat_holder(_role) END)
  END
  FROM public.onboarding_projects p WHERE p.id = _project_id
$$;
GRANT EXECUTE ON FUNCTION public.project_role_assignee(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.instantiate_onboarding_v2(_project_id uuid, _version_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pr onboarding_projects; snap jsonb; step jsonb; n int := 0; anchor date; who uuid; role text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Only onboarding leadership can start a V2 plan.';
  END IF;
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id;
  SELECT snapshot INTO snap FROM onboarding_template_versions WHERE id=_version_id;
  IF pr.id IS NULL OR snap IS NULL THEN RAISE EXCEPTION 'Project or template version not found.'; END IF;
  FOR step IN SELECT * FROM jsonb_array_elements(snap->'steps') LOOP
    role := step->>'functional_role';
    who := CASE WHEN role IS NULL THEN NULL ELSE public.project_role_assignee(_project_id, role) END;
    anchor := CASE step->>'schedule_anchor'
      WHEN 'planned_closing' THEN pr.planned_closing_on
      WHEN 'actual_closing' THEN pr.planned_closing_on
      ELSE pr.possession_on END;
    INSERT INTO onboarding_tasks(property_id,stage,title,detail,assigned_to,assigned_seat,due_on,status,blocks_handoff,is_required,
      requires_owner_approval,evidence_required,sort_order,schedule_anchor,schedule_offset_days,due_on_source,tags,template_task_id,is_demo)
    VALUES (pr.property_id, step->>'stage', step->>'title', step->>'detail', who, role,
      CASE WHEN anchor IS NOT NULL AND step->>'offset_days' IS NOT NULL THEN anchor + (step->>'offset_days')::int END,
      'open', coalesce((step->>'blocks_handoff')::boolean,false), coalesce((step->>'is_required')::boolean,true),
      coalesce((step->>'requires_owner_approval')::boolean,false), coalesce((step->>'evidence_required')::boolean,false),
      coalesce((step->>'sort_order')::int,0), step->>'schedule_anchor', (step->>'offset_days')::int, 'template_v2',
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(step->'tags','[]'::jsonb)) x),'{}'),
      (step->>'id')::uuid, pr.is_demo);
    n := n + 1;
  END LOOP;
  UPDATE onboarding_projects SET template_version_id=_version_id WHERE id=_project_id;
  RETURN n;
END $function$;