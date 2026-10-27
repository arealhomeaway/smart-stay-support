-- Help Ticket #55: files flow between steps (show, never copy).
-- PENDING: not applied. Undo: docs/pending/step-file-links/undo/0166_undo.sql
--
-- 1. Template steps name other steps in the SAME template whose files they show.
-- 2. Home Tasks link to source Tasks on the SAME home (template-created or by hand).
-- 3. Plans started from a template get those links automatically.
-- No file is copied: the receiving Task reads the source Task's live file list.

ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN IF NOT EXISTS show_files_from uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION private.check_template_file_sources() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.show_files_from IS NULL THEN NEW.show_files_from := '{}'; END IF;
  NEW.show_files_from := ARRAY(SELECT DISTINCT x FROM unnest(NEW.show_files_from) x);
  IF NEW.id = ANY(NEW.show_files_from) THEN
    RAISE EXCEPTION 'A step cannot show files from itself.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.show_files_from) s
    WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_template_tasks t WHERE t.id = s AND t.template_id = NEW.template_id)
  ) THEN
    RAISE EXCEPTION 'Steps can only show files from steps in the same template.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_template_file_sources ON public.onboarding_template_tasks;
CREATE TRIGGER check_template_file_sources
  BEFORE INSERT OR UPDATE OF show_files_from, template_id ON public.onboarding_template_tasks
  FOR EACH ROW EXECUTE FUNCTION private.check_template_file_sources();

CREATE TABLE public.onboarding_task_file_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  receiving_task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id),
  source_task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id),
  origin text NOT NULL CHECK (origin IN ('template', 'manual')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid,
  CONSTRAINT onboarding_task_file_links_no_self CHECK (receiving_task_id <> source_task_id)
);
CREATE UNIQUE INDEX onboarding_task_file_links_active
  ON public.onboarding_task_file_links(receiving_task_id, source_task_id) WHERE removed_at IS NULL;
CREATE INDEX onboarding_task_file_links_property ON public.onboarding_task_file_links(property_id);

GRANT SELECT ON public.onboarding_task_file_links TO authenticated;
GRANT ALL ON public.onboarding_task_file_links TO service_role;
ALTER TABLE public.onboarding_task_file_links ENABLE ROW LEVEL SECURITY;
-- Internal staff only. Homeowners and vendors never read links. Writes go through the RPC.
CREATE POLICY "Staff read step file links" ON public.onboarding_task_file_links
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

-- Links never cross homes.
CREATE OR REPLACE FUNCTION private.check_task_file_link_home() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT property_id FROM public.onboarding_tasks WHERE id = NEW.receiving_task_id) IS DISTINCT FROM NEW.property_id
     OR (SELECT property_id FROM public.onboarding_tasks WHERE id = NEW.source_task_id) IS DISTINCT FROM NEW.property_id THEN
    RAISE EXCEPTION 'Steps can only show files from Tasks on the same home.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_task_file_link_home
  BEFORE INSERT OR UPDATE ON public.onboarding_task_file_links
  FOR EACH ROW EXECUTE FUNCTION private.check_task_file_link_home();

-- Hand-linking on a home: same editors as other home-plan edits.
CREATE OR REPLACE FUNCTION public.set_onboarding_task_file_sources(_task_id uuid, _source_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _task public.onboarding_tasks;
  _project public.onboarding_projects;
  _wanted uuid[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(_source_ids, '{}')) x);
  _before uuid[];
BEGIN
  IF _actor IS NULL OR NOT coalesce(private.is_onboarding_staff(_actor), false) THEN
    RAISE EXCEPTION 'Onboarding staff access is required.';
  END IF;
  SELECT * INTO _task FROM public.onboarding_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That Task could not be found.'; END IF;
  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _task.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF NOT coalesce(private.is_onboarding_leader(_actor) OR _project.project_manager = _actor OR _project.director = _actor, false) THEN
    RAISE EXCEPTION 'Only this project lead or a supervisor can change these Tasks.';
  END IF;
  IF _task_id = ANY(_wanted) THEN RAISE EXCEPTION 'A step cannot show files from itself.'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_wanted) s
    WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_tasks t WHERE t.id = s AND t.property_id = _task.property_id AND t.archived_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'Steps can only show files from Tasks on the same home.';
  END IF;

  SELECT coalesce(array_agg(source_task_id ORDER BY source_task_id), '{}') INTO _before
    FROM public.onboarding_task_file_links WHERE receiving_task_id = _task_id AND removed_at IS NULL;

  UPDATE public.onboarding_task_file_links SET removed_at = now(), removed_by = _actor
    WHERE receiving_task_id = _task_id AND removed_at IS NULL AND NOT (source_task_id = ANY(_wanted));
  INSERT INTO public.onboarding_task_file_links(property_id, receiving_task_id, source_task_id, origin, created_by)
    SELECT _task.property_id, _task_id, s, 'manual', _actor FROM unnest(_wanted) s
    WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_task_file_links l
                      WHERE l.receiving_task_id = _task_id AND l.source_task_id = s AND l.removed_at IS NULL);

  IF _before IS DISTINCT FROM ARRAY(SELECT x FROM unnest(_wanted) x ORDER BY x) THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
    VALUES (_actor, 'onboarding_task.file_sources_changed', 'onboarding_task', _task_id, _task.title,
            jsonb_build_object('sourceTaskIds', to_jsonb(_before)),
            jsonb_build_object('sourceTaskIds', to_jsonb(ARRAY(SELECT x FROM unnest(_wanted) x ORDER BY x))));
  END IF;
  RETURN coalesce(array_length(_wanted, 1), 0);
END $$;
REVOKE ALL ON FUNCTION public.set_onboarding_task_file_sources(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_onboarding_task_file_sources(uuid, uuid[]) TO authenticated;

-- Plans started from a template: same body as live, plus links at the end.
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
END $function$;
