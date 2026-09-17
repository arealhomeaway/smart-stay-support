-- Unapplied. Stage captures are an append-only event stream in the existing
-- project history; the highest revision is the canonical record for a stage.
CREATE UNIQUE INDEX onboarding_stage_capture_revision_idx
  ON public.onboarding_project_events(project_id, kind, ((new_value::jsonb ->> 'revision')::integer))
  WHERE kind LIKE 'stage_capture:%';

CREATE FUNCTION public.protect_onboarding_stage_capture() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind LIKE 'stage_capture:%' AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Use the stage capture workflow to record a revision.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_onboarding_stage_capture BEFORE INSERT ON public.onboarding_project_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_stage_capture();

CREATE FUNCTION public.record_onboarding_stage_capture(
  _project_id uuid, _actor uuid, _expected_revision integer, _capture jsonb,
  _tasks jsonb, _scope jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  project public.onboarding_projects%ROWTYPE;
  actual_tasks jsonb;
  previous text;
  stage_key text := _capture ->> 'stage';
  actual_revision integer;
BEGIN
  IF NOT public.is_onboarding_staff(_actor) THEN RAISE EXCEPTION 'Stage capture requires onboarding staff.'; END IF;
  SELECT * INTO project FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding project is not available.'; END IF;
  IF jsonb_build_object('modules', project.modules, 'furnishing_scope', project.furnishing_scope, 'director', project.director)
     IS DISTINCT FROM _scope THEN RAISE EXCEPTION 'Project scope changed. Refresh before saving.'; END IF;
  PERFORM id FROM public.properties WHERE id = project.property_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.properties WHERE id = project.property_id AND
      (handoff_accepted_at IS NOT NULL OR lifecycle_status IN ('active_operations','handoff_requested')))
    THEN RAISE EXCEPTION 'The onboarding plan is locked for handoff.'; END IF;
  SELECT new_value INTO previous FROM public.onboarding_project_events
    WHERE project_id = _project_id AND kind = 'stage_capture:' || stage_key
    ORDER BY (new_value::jsonb ->> 'revision')::integer DESC LIMIT 1;
  actual_revision := coalesce((previous::jsonb ->> 'revision')::integer, 0);
  IF actual_revision <> _expected_revision OR (_capture ->> 'revision')::integer <> actual_revision + 1 THEN
    RAISE EXCEPTION 'This stage changed. Refresh before saving.';
  END IF;
  PERFORM id FROM public.onboarding_tasks WHERE property_id = project.property_id
    AND stage = stage_key AND archived_at IS NULL ORDER BY id FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) INTO actual_tasks
    FROM public.onboarding_tasks t WHERE property_id = project.property_id AND stage = stage_key AND archived_at IS NULL;
  IF actual_tasks IS DISTINCT FROM _tasks THEN RAISE EXCEPTION 'Stage work changed. Refresh before saving.'; END IF;
  IF _capture ->> 'status' IN ('complete','awaiting_review') AND EXISTS
    (SELECT 1 FROM public.property_fact_proposals WHERE property_id = project.property_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Permanent property facts await review.';
  END IF;
  INSERT INTO public.onboarding_project_events
    (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  VALUES (_project_id, project.property_id, 'stage_capture:' || stage_key,
    'Stage ' || stage_key || ': ' || (_capture ->> 'status') || ' (revision ' || (_capture ->> 'revision') || ')',
    _capture ->> 'reason', previous, _capture::text, _actor, project.is_demo);
END $$;
REVOKE ALL ON FUNCTION public.record_onboarding_stage_capture(uuid, uuid, integer, jsonb, jsonb, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_stage_capture(uuid, uuid, integer, jsonb, jsonb, jsonb) TO service_role;

CREATE VIEW public.onboarding_stage_captures WITH (security_invoker = true) AS
  SELECT DISTINCT ON (project_id, kind) project_id, property_id, new_value
  FROM public.onboarding_project_events WHERE kind LIKE 'stage_capture:%'
  ORDER BY project_id, kind, (new_value::jsonb ->> 'revision')::integer DESC;
GRANT SELECT ON public.onboarding_stage_captures TO authenticated, service_role;
