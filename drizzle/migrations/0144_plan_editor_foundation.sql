-- #30 four optional step fields (Instructions reuse the existing detail column)
ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS done_when text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS offset_unit text NOT NULL DEFAULT 'calendar';
ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS done_when text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS schedule_offset_unit text NOT NULL DEFAULT 'calendar';
DO $$ BEGIN
  ALTER TABLE public.onboarding_template_tasks ADD CONSTRAINT ott_offset_unit_chk CHECK (offset_unit IN ('calendar','business'));
  ALTER TABLE public.onboarding_tasks ADD CONSTRAINT ot_offset_unit_chk CHECK (schedule_offset_unit IN ('calendar','business'));
  ALTER TABLE public.onboarding_template_tasks ADD CONSTRAINT ott_video_https_chk CHECK (video_url IS NULL OR video_url ~ '^https://');
  ALTER TABLE public.onboarding_tasks ADD CONSTRAINT ot_video_https_chk CHECK (video_url IS NULL OR video_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.onboarding_template_tasks.detail IS 'Instructions: how to do the step.';

-- #31 business days = Mon-Fri, no holiday calendar
CREATE OR REPLACE FUNCTION public.add_business_days(_d date, _n int)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d date := _d; left_n int := abs(_n); step int := CASE WHEN _n < 0 THEN -1 ELSE 1 END;
BEGIN
  IF _d IS NULL OR _n IS NULL THEN RETURN NULL; END IF;
  WHILE left_n > 0 LOOP
    d := d + step;
    IF extract(isodow FROM d) < 6 THEN left_n := left_n - 1; END IF;
  END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.plan_due_from_rule(_anchor date, _offset int, _unit text)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _anchor IS NULL OR _offset IS NULL THEN NULL
    WHEN _unit = 'business' THEN public.add_business_days(_anchor, _offset)
    ELSE _anchor + _offset END
$$;

-- #42 structured conditions: ALL clauses must hold; no conditions = applies everywhere
CREATE OR REPLACE FUNCTION public.plan_step_applies(_condition jsonb, _furnishing text, _modules text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_array_length(_condition->'all'),0) = 0 OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(_condition->'all') c
    WHERE NOT CASE c->>'field'
      WHEN 'furnishing_scope' THEN coalesce(_furnishing,'') = c->>'value'
      WHEN 'module' THEN (c->>'value') = ANY(coalesce(_modules,'{}'))
      ELSE false END)
$$;

CREATE OR REPLACE FUNCTION public.instantiate_onboarding_v2(_project_id uuid, _version_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

-- #31 anchor change: recalc unfinished, non-overridden Tasks that follow a business-day
-- or new-anchor rule. Existing calendar access rules keep their existing preview/apply path.
CREATE OR REPLACE FUNCTION private.recalc_plan_dates_on_anchor_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE onboarding_tasks t SET due_on = public.plan_due_from_rule(
      CASE t.schedule_anchor WHEN 'planned_closing' THEN NEW.planned_closing_on
        WHEN 'target_handoff' THEN NEW.target_handoff_on
        WHEN 'actual_access' THEN NEW.possession_on END,
      t.schedule_offset_days, t.schedule_offset_unit)
  WHERE t.property_id = NEW.property_id AND t.archived_at IS NULL
    AND t.status NOT IN ('complete','done') AND NOT t.due_on_overridden
    AND t.schedule_offset_days IS NOT NULL
    AND t.due_on_source = 'template_v2'
    AND ((t.schedule_anchor='planned_closing' AND NEW.planned_closing_on IS DISTINCT FROM OLD.planned_closing_on)
      OR (t.schedule_anchor='target_handoff' AND NEW.target_handoff_on IS DISTINCT FROM OLD.target_handoff_on)
      OR (t.schedule_anchor='actual_access' AND NEW.possession_on IS DISTINCT FROM OLD.possession_on));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS recalc_plan_dates_on_anchor_change ON public.onboarding_projects;
CREATE TRIGGER recalc_plan_dates_on_anchor_change AFTER UPDATE OF planned_closing_on, target_handoff_on, possession_on
  ON public.onboarding_projects FOR EACH ROW EXECUTE FUNCTION private.recalc_plan_dates_on_anchor_change();