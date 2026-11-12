-- Owner Opportunities and Task Drawer, staged file 04 (approved by the Admin, Nov 11). Independent of 01 to 03.
-- B1 "Mark as started": two additive columns and one caller-authenticated RPC with an audit row.
--   The drawer shows the button only once these columns exist. Status, clocks and completion are unchanged.
-- B2.2 Work order section on both title forms: save_onboarding_task_breezeway also accepts
--   "Draft work order:" titles. Only that one title test changes; Send to Breezeway stays behind its
--   switch (off). Live text before: live-capture/save_onboarding_task_breezeway.sql.
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS started_by uuid;
COMMENT ON COLUMN public.onboarding_tasks.started_at IS 'When someone working the Task pressed Mark as started. Display only.';

CREATE OR REPLACE FUNCTION public.mark_onboarding_task_started(_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _task public.onboarding_tasks%ROWTYPE;
  _project public.onboarding_projects%ROWTYPE;
BEGIN
  IF _actor IS NULL OR NOT COALESCE(private.is_onboarding_staff(_actor), false) THEN
    RAISE EXCEPTION 'Onboarding staff access is required.';
  END IF;
  SELECT * INTO _task FROM public.onboarding_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND OR _task.archived_at IS NOT NULL THEN RAISE EXCEPTION 'That task is not available.'; END IF;
  IF _task.status IN ('complete', 'carryover') THEN RAISE EXCEPTION 'This task is already finished.'; END IF;
  IF private.onboarding_work_locked(ARRAY[_task.property_id]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked.';
  END IF;
  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _task.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  -- The same people who may work the Task today (save_onboarding_task_breezeway, onboardingTaskAccess).
  IF NOT COALESCE(private.is_supervisor(_actor) OR public.is_onboarding_director(_actor)
                  OR _project.project_manager = _actor OR _project.director = _actor
                  OR _task.assigned_to = _actor, false) THEN
    RAISE EXCEPTION 'This work is not assigned to you or a project you lead.';
  END IF;
  IF _task.started_at IS NOT NULL THEN
    RETURN jsonb_build_object('started_at', _task.started_at, 'changed', false);
  END IF;
  UPDATE public.onboarding_tasks SET started_at = now(), started_by = _actor WHERE id = _task_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (_actor, 'onboarding_task_started', 'onboarding_task', _task_id, _task.title,
          jsonb_build_object('started_at', NULL), jsonb_build_object('started_at', now()));
  RETURN jsonb_build_object('started_at', now(), 'changed', true);
END $function$;
REVOKE ALL ON FUNCTION public.mark_onboarding_task_started(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_onboarding_task_started(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_onboarding_task_breezeway(_task_id uuid, _tentative_date date, _assignee_choice text, _breezeway_person_id bigint, _breezeway_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _task public.onboarding_tasks%ROWTYPE;
  _project public.onboarding_projects%ROWTYPE;
  _prior public.onboarding_task_breezeway_links%ROWTYPE;
  _had_prior boolean;
  _ref text := btrim(COALESCE(_breezeway_ref, ''));
  _bz_id bigint;
  _bz_url text;
  _name text;
  _other text;
  _saved public.onboarding_task_breezeway_links%ROWTYPE;
BEGIN
  IF _actor IS NULL OR NOT COALESCE(private.is_onboarding_staff(_actor), false) THEN
    RAISE EXCEPTION 'Onboarding staff access is required.';
  END IF;
  SELECT * INTO _task FROM public.onboarding_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND OR _task.archived_at IS NOT NULL THEN RAISE EXCEPTION 'That task is not available.'; END IF;
  IF _task.title !~* '^\s*(draft\s+)?work order\s*:' THEN
    RAISE EXCEPTION 'Only Work order tasks carry a Breezeway work order.';
  END IF;
  IF private.onboarding_work_locked(ARRAY[_task.property_id]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked.';
  END IF;
  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _task.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF NOT COALESCE(private.is_supervisor(_actor) OR public.is_onboarding_director(_actor)
                  OR _project.project_manager = _actor OR _project.director = _actor
                  OR _task.assigned_to = _actor, false) THEN
    RAISE EXCEPTION 'This work is not assigned to you or a project you lead.';
  END IF;

  IF _assignee_choice IS NOT NULL AND _assignee_choice NOT IN ('unassigned', 'person') THEN
    RAISE EXCEPTION 'Choose a Breezeway person or Leave unassigned.';
  END IF;
  IF _assignee_choice = 'person' THEN
    SELECT btrim(concat_ws(' ', first_name, last_name)) INTO _name FROM public.breezeway_people
      WHERE breezeway_person_id = _breezeway_person_id AND active AND NOT COALESCE(is_integration_identity, false);
    IF _name IS NULL THEN RAISE EXCEPTION 'That person is not active in Breezeway.'; END IF;
  ELSE
    _breezeway_person_id := NULL;
  END IF;

  IF _ref <> '' THEN
    IF _ref ~ '^#?[0-9]{1,15}$' THEN
      _bz_id := replace(_ref, '#', '')::bigint;
    ELSIF _ref ~* '^https://app\.breezeway\.io/\S*?\mtasks?/[0-9]{1,15}' THEN
      _bz_id := substring(_ref from '(?i)tasks?/([0-9]{1,15})')::bigint;
      _bz_url := _ref;
    ELSE
      RAISE EXCEPTION 'Paste the Breezeway task number, or its link from app.breezeway.io.';
    END IF;
    SELECT t.title INTO _other FROM public.onboarding_task_breezeway_links l
      JOIN public.onboarding_tasks t ON t.id = l.task_id
      WHERE l.breezeway_task_id = _bz_id AND l.task_id <> _task_id;
    IF _other IS NOT NULL THEN RAISE EXCEPTION 'That Breezeway task is already linked to %.', _other; END IF;
  END IF;

  SELECT * INTO _prior FROM public.onboarding_task_breezeway_links WHERE task_id = _task_id FOR UPDATE;
  _had_prior := FOUND;
  INSERT INTO public.onboarding_task_breezeway_links AS l(
    task_id, property_id, tentative_date, assignee_choice, breezeway_person_id, assignee_name,
    breezeway_task_id, breezeway_url, is_demo, created_by, updated_by)
  VALUES (_task_id, _task.property_id, _tentative_date, _assignee_choice, _breezeway_person_id, _name,
          _bz_id, _bz_url, COALESCE(_task.is_demo, false), _actor, _actor)
  ON CONFLICT (task_id) DO UPDATE SET
    tentative_date = EXCLUDED.tentative_date,
    assignee_choice = EXCLUDED.assignee_choice,
    breezeway_person_id = EXCLUDED.breezeway_person_id,
    assignee_name = EXCLUDED.assignee_name,
    breezeway_task_id = EXCLUDED.breezeway_task_id,
    breezeway_url = EXCLUDED.breezeway_url,
    updated_by = _actor,
    updated_at = now()
  RETURNING * INTO _saved;

  INSERT INTO public.onboarding_task_breezeway_events(task_id, property_id, actor, before_value, after_value, is_demo)
  VALUES (_task_id, _task.property_id, _actor,
          CASE WHEN _had_prior THEN jsonb_build_object(
            'tentative_date', _prior.tentative_date, 'assignee_choice', _prior.assignee_choice,
            'breezeway_person_id', _prior.breezeway_person_id, 'assignee_name', _prior.assignee_name,
            'breezeway_task_id', _prior.breezeway_task_id, 'breezeway_url', _prior.breezeway_url) END,
          jsonb_build_object(
            'tentative_date', _saved.tentative_date, 'assignee_choice', _saved.assignee_choice,
            'breezeway_person_id', _saved.breezeway_person_id, 'assignee_name', _saved.assignee_name,
            'breezeway_task_id', _saved.breezeway_task_id, 'breezeway_url', _saved.breezeway_url),
          COALESCE(_task.is_demo, false));

  RETURN to_jsonb(_saved);
END $function$;
