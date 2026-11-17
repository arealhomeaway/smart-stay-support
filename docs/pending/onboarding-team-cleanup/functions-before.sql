CREATE OR REPLACE FUNCTION public.bulk_update_onboarding_home_tasks(_property_id uuid, _task_ids uuid[], _set_due_on boolean DEFAULT false, _due_on date DEFAULT NULL::date, _set_offset_unit boolean DEFAULT false, _offset_unit text DEFAULT NULL::text, _set_role boolean DEFAULT false, _role text DEFAULT NULL::text, _set_is_required boolean DEFAULT false, _is_required boolean DEFAULT NULL::boolean, _set_blocks_handoff boolean DEFAULT false, _blocks_handoff boolean DEFAULT NULL::boolean, _set_stage boolean DEFAULT false, _stage text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _project public.onboarding_projects%ROWTYPE;
  _home public.properties%ROWTYPE;
  _selected_count integer;
  _changed_count integer;
  _bad text;
  _skipped jsonb;
  _audit jsonb;
  _ready_before integer;
  _ready_after integer;
BEGIN
  IF _actor IS NULL OR NOT COALESCE(private.is_onboarding_staff(_actor), false) THEN
    RAISE EXCEPTION 'Onboarding staff access is required.';
  END IF;

  -- Lock order matches the single-Task date override: project, property, then Tasks.
  SELECT * INTO _project FROM public.onboarding_projects
  WHERE property_id = _property_id AND status <> 'cancelled'
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Start the onboarding project before editing its Tasks.';
  END IF;
  -- Same people as one-at-a-time editing: Supervisor/Admin, Onboarding Director,
  -- or this home's Project Manager or Director.
  IF NOT COALESCE(private.is_onboarding_leader(_actor) OR _project.project_manager = _actor OR _project.director = _actor, false) THEN
    RAISE EXCEPTION 'Only this project lead or a supervisor can change these Tasks.';
  END IF;

  SELECT * INTO _home FROM public.properties WHERE id = _property_id FOR UPDATE;
  IF NOT FOUND OR _home.handoff_accepted_at IS NOT NULL
     OR _home.lifecycle_status IN ('handoff_requested', 'active_operations', 'offboarded') THEN
    RAISE EXCEPTION 'Operations has accepted this home, so onboarding Tasks are locked.';
  END IF;

  _task_ids := COALESCE((SELECT array_agg(DISTINCT id) FROM unnest(_task_ids) AS ids(id)), '{}'::uuid[]);
  IF cardinality(_task_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one Task.';
  END IF;
  IF NOT (_set_due_on OR _set_offset_unit OR _set_role OR _set_is_required OR _set_blocks_handoff OR _set_stage) THEN
    RAISE EXCEPTION 'Choose at least one change.';
  END IF;
  IF _set_due_on AND _due_on IS NULL THEN
    RAISE EXCEPTION 'Pick a due date.';
  END IF;
  IF _set_offset_unit AND (_offset_unit IS NULL OR _offset_unit NOT IN ('calendar', 'business')) THEN
    RAISE EXCEPTION 'Choose calendar days or business days.';
  END IF;
  IF _set_is_required AND _is_required IS NULL THEN
    RAISE EXCEPTION 'Choose Required or Optional.';
  END IF;
  IF _set_blocks_handoff AND _blocks_handoff IS NULL THEN
    RAISE EXCEPTION 'Choose whether these Tasks block handoff.';
  END IF;
  IF _set_role AND _role IS NOT NULL AND _role <> ALL(ARRAY[
    'onboarding_director', 'onboarding_manager', 'onboarding_project_manager', 'utilities',
    'lead_designer', 'designer', 'staging_team', 'design_staging', 'director_ops', 'property_coordinator'
  ]) THEN
    RAISE EXCEPTION 'Choose an internal assigned role.';
  END IF;
  IF _set_stage THEN
    _stage := btrim(COALESCE(_stage, ''));
    IF _stage = '' OR char_length(_stage) > 40 OR NOT EXISTS (
      SELECT 1 FROM public.onboarding_tasks
      WHERE property_id = _property_id AND archived_at IS NULL AND stage = _stage
    ) THEN
      RAISE EXCEPTION 'Choose a stage already on this home''s plan.';
    END IF;
  END IF;

  PERFORM 1 FROM public.onboarding_tasks
  WHERE property_id = _property_id AND id = ANY(_task_ids)
  FOR UPDATE;

  DROP TABLE IF EXISTS pg_temp.bulk_home_selected;
  CREATE TEMPORARY TABLE bulk_home_selected ON COMMIT DROP AS
  SELECT id, title, stage, sort_order, status, archived_at, exception_at, due_on, due_on_overridden,
         due_on_source, schedule_offset_unit, assigned_seat, assigned_to, is_required, blocks_handoff,
         requires_owner_approval, tags
  FROM public.onboarding_tasks
  WHERE property_id = _property_id AND id = ANY(_task_ids);

  SELECT count(*) INTO _selected_count FROM bulk_home_selected;
  IF _selected_count <> cardinality(_task_ids) THEN
    RAISE EXCEPTION 'Some selected Tasks are not on this home''s plan. Refresh and try again.';
  END IF;

  -- HARD RULE: completed, archived and exception Tasks never change.
  SELECT string_agg(title || ' (' || CASE
           WHEN status IN ('complete', 'done') THEN 'completed'
           WHEN archived_at IS NOT NULL THEN 'voided'
           WHEN exception_at IS NOT NULL THEN 'has an exception'
           ELSE 'carried over' END || ')', '; ' ORDER BY sort_order, id)
  INTO _bad
  FROM bulk_home_selected
  WHERE status IN ('complete', 'done', 'carryover') OR archived_at IS NOT NULL OR exception_at IS NOT NULL;
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'Nothing was changed. These Tasks cannot be edited: %', _bad;
  END IF;

  -- Same stage lock as one-at-a-time: a stage under review or complete is frozen (from and to).
  SELECT string_agg(DISTINCT st, ', ') INTO _bad
  FROM (
    SELECT stage AS st FROM bulk_home_selected
    UNION SELECT _stage WHERE _set_stage
  ) s
  WHERE (
    SELECT e.new_value::jsonb->>'status'
    FROM public.onboarding_project_events e
    WHERE e.project_id = _project.id AND e.kind = 'stage_capture:' || s.st
    ORDER BY (e.new_value::jsonb->>'revision')::integer DESC
    LIMIT 1
  ) IN ('complete', 'awaiting_review');
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'Nothing was changed. Return or reopen these stages first: %', _bad;
  END IF;

  SELECT count(*) INTO _ready_before FROM public.onboarding_tasks
  WHERE property_id = _property_id AND archived_at IS NULL AND blocks_handoff AND is_required
    AND status NOT IN ('complete', 'done');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'taskId', id, 'title', title,
    'reason', 'Homeowner or Active Owner Tasks are left as non-blocking.'
  ) ORDER BY sort_order, id), '[]'::jsonb)
  INTO _skipped
  FROM bulk_home_selected
  WHERE _set_blocks_handoff AND _blocks_handoff
    AND (COALESCE(requires_owner_approval, false) OR COALESCE(tags, '{}'::text[]) @> ARRAY['active_owner']);

  DROP TABLE IF EXISTS pg_temp.bulk_home_effective;
  CREATE TEMPORARY TABLE bulk_home_effective ON COMMIT DROP AS
  WITH eligible AS (
    SELECT s.*,
      (_set_blocks_handoff AND _blocks_handoff
        AND (COALESCE(s.requires_owner_approval, false) OR COALESCE(s.tags, '{}'::text[]) @> ARRAY['active_owner'])) AS skip_blocks
    FROM bulk_home_selected s
  ), changed AS (
    SELECT e.* FROM eligible e
    WHERE (_set_due_on AND (e.due_on IS DISTINCT FROM _due_on OR NOT COALESCE(e.due_on_overridden, false)))
       OR (_set_offset_unit AND e.schedule_offset_unit IS DISTINCT FROM _offset_unit)
       OR (_set_role AND e.assigned_seat IS DISTINCT FROM _role)
       OR (_set_is_required AND e.is_required IS DISTINCT FROM _is_required)
       OR (_set_blocks_handoff AND NOT e.skip_blocks AND e.blocks_handoff IS DISTINCT FROM _blocks_handoff)
       OR (_set_stage AND e.stage IS DISTINCT FROM _stage)
  ), moving AS (
    SELECT c.id,
      COALESCE((
        SELECT max(t.sort_order) FROM public.onboarding_tasks t
        WHERE t.property_id = _property_id AND t.stage = _stage
          AND NOT EXISTS (SELECT 1 FROM changed x WHERE x.id = t.id AND x.stage IS DISTINCT FROM _stage)
      ), 0) + row_number() OVER (ORDER BY c.sort_order, c.id) * 10 AS new_sort_order
    FROM changed c
    WHERE _set_stage AND c.stage IS DISTINCT FROM _stage
  )
  SELECT c.*, m.new_sort_order FROM changed c LEFT JOIN moving m ON m.id = c.id;

  SELECT count(*) INTO _changed_count FROM bulk_home_effective;

  IF _changed_count > 0 THEN
    UPDATE public.onboarding_tasks t SET
      due_on = CASE WHEN _set_due_on THEN _due_on ELSE t.due_on END,
      due_on_overridden = CASE WHEN _set_due_on THEN true ELSE t.due_on_overridden END,
      due_on_source = CASE WHEN _set_due_on THEN 'manual' ELSE t.due_on_source END,
      schedule_offset_unit = CASE WHEN _set_offset_unit THEN _offset_unit ELSE t.schedule_offset_unit END,
      -- The person then comes from whoever holds that role on this home.
      assigned_seat = CASE WHEN _set_role AND t.assigned_seat IS DISTINCT FROM _role THEN _role ELSE t.assigned_seat END,
      assigned_to = CASE WHEN _set_role AND t.assigned_seat IS DISTINCT FROM _role THEN NULL ELSE t.assigned_to END,
      is_required = CASE WHEN _set_is_required THEN _is_required ELSE t.is_required END,
      blocks_handoff = CASE WHEN _set_blocks_handoff AND NOT e.skip_blocks THEN _blocks_handoff ELSE t.blocks_handoff END,
      stage = CASE WHEN _set_stage THEN _stage ELSE t.stage END,
      sort_order = COALESCE(e.new_sort_order, t.sort_order)
    FROM bulk_home_effective e
    WHERE t.id = e.id;

    -- Per Task, per field: only the fields that actually changed, old -> new.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'taskId', t.id, 'title', t.title,
      'before', jsonb_strip_nulls(jsonb_build_object(
        'due_on', CASE WHEN e.due_on IS DISTINCT FROM t.due_on THEN to_jsonb(e.due_on) END,
        'due_on_overridden', CASE WHEN e.due_on_overridden IS DISTINCT FROM t.due_on_overridden THEN to_jsonb(e.due_on_overridden) END,
        'schedule_offset_unit', CASE WHEN e.schedule_offset_unit IS DISTINCT FROM t.schedule_offset_unit THEN to_jsonb(e.schedule_offset_unit) END,
        'assigned_seat', CASE WHEN e.assigned_seat IS DISTINCT FROM t.assigned_seat THEN COALESCE(to_jsonb(e.assigned_seat), '"none"'::jsonb) END,
        'assigned_to', CASE WHEN e.assigned_to IS DISTINCT FROM t.assigned_to THEN COALESCE(to_jsonb(e.assigned_to), '"none"'::jsonb) END,
        'is_required', CASE WHEN e.is_required IS DISTINCT FROM t.is_required THEN to_jsonb(e.is_required) END,
        'blocks_handoff', CASE WHEN e.blocks_handoff IS DISTINCT FROM t.blocks_handoff THEN to_jsonb(e.blocks_handoff) END,
        'stage', CASE WHEN e.stage IS DISTINCT FROM t.stage THEN to_jsonb(e.stage) END
      )),
      'after', jsonb_strip_nulls(jsonb_build_object(
        'due_on', CASE WHEN e.due_on IS DISTINCT FROM t.due_on THEN to_jsonb(t.due_on) END,
        'due_on_overridden', CASE WHEN e.due_on_overridden IS DISTINCT FROM t.due_on_overridden THEN to_jsonb(t.due_on_overridden) END,
        'schedule_offset_unit', CASE WHEN e.schedule_offset_unit IS DISTINCT FROM t.schedule_offset_unit THEN to_jsonb(t.schedule_offset_unit) END,
        'assigned_seat', CASE WHEN e.assigned_seat IS DISTINCT FROM t.assigned_seat THEN COALESCE(to_jsonb(t.assigned_seat), '"none"'::jsonb) END,
        'assigned_to', CASE WHEN e.assigned_to IS DISTINCT FROM t.assigned_to THEN COALESCE(to_jsonb(t.assigned_to), '"none"'::jsonb) END,
        'is_required', CASE WHEN e.is_required IS DISTINCT FROM t.is_required THEN to_jsonb(t.is_required) END,
        'blocks_handoff', CASE WHEN e.blocks_handoff IS DISTINCT FROM t.blocks_handoff THEN to_jsonb(t.blocks_handoff) END,
        'stage', CASE WHEN e.stage IS DISTINCT FROM t.stage THEN to_jsonb(t.stage) END
      ))
    ) ORDER BY e.sort_order, e.id), '[]'::jsonb)
    INTO _audit
    FROM public.onboarding_tasks t JOIN bulk_home_effective e ON e.id = t.id;

    PERFORM private.write_onboarding_task_bulk_audit(_actor, _audit);
  END IF;

  SELECT count(*) INTO _ready_after FROM public.onboarding_tasks
  WHERE property_id = _property_id AND archived_at IS NULL AND blocks_handoff AND is_required
    AND status NOT IN ('complete', 'done');

  RETURN jsonb_build_object(
    'changed', _changed_count,
    'skipped', _skipped,
    'auditRecorded', _changed_count > 0,
    'blockingBefore', _ready_before,
    'blockingAfter', _ready_after
  );
END $function$;

CREATE OR REPLACE FUNCTION public.bulk_update_onboarding_template_steps(_template_id uuid, _step_ids uuid[], _set_due_rule boolean DEFAULT false, _offset_days integer DEFAULT NULL::integer, _schedule_anchor text DEFAULT NULL::text, _set_offset_unit boolean DEFAULT false, _offset_unit text DEFAULT NULL::text, _set_functional_role boolean DEFAULT false, _functional_role text DEFAULT NULL::text, _set_is_required boolean DEFAULT false, _is_required boolean DEFAULT NULL::boolean, _set_blocks_handoff boolean DEFAULT false, _blocks_handoff boolean DEFAULT NULL::boolean, _set_stage boolean DEFAULT false, _stage text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _template public.onboarding_templates%ROWTYPE;
  _selected_count integer;
  _changed_count integer;
  _before jsonb;
  _after jsonb;
  _skipped jsonb;
  _patch jsonb;
  _role_label text;
BEGIN
  IF _actor IS NULL OR NOT private.is_onboarding_leader(_actor) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or a Supervisor can change templates.';
  END IF;

  SELECT * INTO _template
  FROM public.onboarding_templates
  WHERE id = _template_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That template no longer exists.';
  END IF;

  _step_ids := COALESCE((SELECT array_agg(DISTINCT id) FROM unnest(_step_ids) AS ids(id)), '{}'::uuid[]);
  IF cardinality(_step_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one step.';
  END IF;
  IF NOT (_set_due_rule OR _set_offset_unit OR _set_functional_role OR _set_is_required OR _set_blocks_handoff OR _set_stage) THEN
    RAISE EXCEPTION 'Choose at least one change.';
  END IF;

  IF _set_due_rule THEN
    IF _offset_days IS NULL THEN
      _schedule_anchor := NULL;
    ELSE
      IF _offset_days < -260 OR _offset_days > 365 THEN
        RAISE EXCEPTION 'Days must be from -260 to 365.';
      END IF;
      IF _schedule_anchor NOT IN ('project_created', 'planned_closing', 'actual_access', 'target_handoff', 'actual_closing') THEN
        RAISE EXCEPTION 'Choose what the due date starts from.';
      END IF;
    END IF;
  END IF;

  IF _set_offset_unit AND (_offset_unit IS NULL OR _offset_unit NOT IN ('calendar', 'business')) THEN
    RAISE EXCEPTION 'Choose calendar days or business days.';
  END IF;
  IF _set_is_required AND _is_required IS NULL THEN
    RAISE EXCEPTION 'Choose Required or Optional.';
  END IF;
  IF _set_blocks_handoff AND _blocks_handoff IS NULL THEN
    RAISE EXCEPTION 'Choose whether these steps block handoff.';
  END IF;

  IF _set_functional_role THEN
    IF _functional_role IS NOT NULL AND _functional_role <> ALL(ARRAY[
      'onboarding_director', 'onboarding_manager', 'onboarding_project_manager', 'utilities',
      'lead_designer', 'designer', 'staging_team', 'design_staging', 'director_ops', 'property_coordinator'
    ]) THEN
      RAISE EXCEPTION 'Choose an internal assigned role.';
    END IF;
    _role_label := CASE _functional_role
      WHEN 'onboarding_director' THEN 'Director of Onboarding'
      WHEN 'onboarding_manager' THEN 'Onboarding Manager'
      WHEN 'onboarding_project_manager' THEN 'Project Manager'
      WHEN 'utilities' THEN 'Onboarding Utilities Coordinator'
      WHEN 'lead_designer' THEN 'Lead Designer'
      WHEN 'designer' THEN 'Designer'
      WHEN 'staging_team' THEN 'Staging Team'
      WHEN 'design_staging' THEN 'Design & Staging (older steps)'
      WHEN 'director_ops' THEN 'Operations Director'
      WHEN 'property_coordinator' THEN 'Property Coordinator'
      ELSE NULL END;
  END IF;

  IF _set_stage THEN
    _stage := btrim(COALESCE(_stage, ''));
    IF _stage = '' OR char_length(_stage) > 80 THEN
      RAISE EXCEPTION 'Choose a stage in this template.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.onboarding_template_stages
      WHERE template_id = _template_id AND name = _stage AND active
    ) AND NOT EXISTS (
      SELECT 1 FROM public.onboarding_template_tasks
      WHERE template_id = _template_id AND stage = _stage
    ) THEN
      RAISE EXCEPTION 'Choose a stage in this template.';
    END IF;
  END IF;

  -- Lock the selected template rows before validating and updating them.
  PERFORM 1
  FROM public.onboarding_template_tasks
  WHERE template_id = _template_id AND id = ANY(_step_ids)
  FOR UPDATE;

  DROP TABLE IF EXISTS pg_temp.bulk_template_selected;
  CREATE TEMPORARY TABLE bulk_template_selected ON COMMIT DROP AS
  SELECT id, title, stage, sort_order, functional_role, is_required, blocks_handoff,
         offset_days, schedule_anchor, offset_unit, requires_owner_approval, tags
  FROM public.onboarding_template_tasks
  WHERE template_id = _template_id AND id = ANY(_step_ids)
  ORDER BY sort_order, id;

  SELECT count(*) INTO _selected_count FROM bulk_template_selected;
  IF _selected_count <> cardinality(_step_ids) THEN
    RAISE EXCEPTION 'Some selected steps are no longer in this template. Refresh and try again.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'stepId', id,
    'title', title,
    'reason', 'Homeowner or Active Owner steps are left as non-blocking.'
  ) ORDER BY sort_order, id), '[]'::jsonb)
  INTO _skipped
  FROM bulk_template_selected
  WHERE _set_blocks_handoff
    AND _blocks_handoff
    AND (COALESCE(requires_owner_approval, false) OR COALESCE(tags, '{}'::text[]) @> ARRAY['active_owner']);

  DROP TABLE IF EXISTS pg_temp.bulk_template_effective;
  CREATE TEMPORARY TABLE bulk_template_effective ON COMMIT DROP AS
  WITH changed AS (
    SELECT s.*
    FROM bulk_template_selected s
    WHERE NOT (
      _set_blocks_handoff AND _blocks_handoff
      AND (COALESCE(s.requires_owner_approval, false) OR COALESCE(s.tags, '{}'::text[]) @> ARRAY['active_owner'])
    )
    AND (
      (_set_due_rule AND (
        s.offset_days IS DISTINCT FROM _offset_days OR
        s.schedule_anchor IS DISTINCT FROM _schedule_anchor
      ))
      OR (_set_offset_unit AND s.offset_unit IS DISTINCT FROM _offset_unit)
      OR (_set_functional_role AND s.functional_role IS DISTINCT FROM _functional_role)
      OR (_set_is_required AND s.is_required IS DISTINCT FROM _is_required)
      OR (_set_blocks_handoff AND s.blocks_handoff IS DISTINCT FROM _blocks_handoff)
      OR (_set_stage AND s.stage IS DISTINCT FROM _stage)
    )
  ), moving AS (
    SELECT c.*,
      COALESCE((
        SELECT max(t.sort_order)
        FROM public.onboarding_template_tasks t
        WHERE t.template_id = _template_id
          AND t.stage = _stage
          AND NOT EXISTS (
            SELECT 1 FROM changed x
            WHERE x.id = t.id AND x.stage IS DISTINCT FROM _stage
          )
      ), 0) + row_number() OVER (ORDER BY c.sort_order, c.id) * 10 AS new_sort_order
    FROM changed c
    WHERE _set_stage AND c.stage IS DISTINCT FROM _stage
  )
  SELECT c.*, m.new_sort_order
  FROM changed c
  LEFT JOIN moving m ON m.id = c.id;

  SELECT count(*) INTO _changed_count FROM bulk_template_effective;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'stepId', id,
    'title', title,
    'offsetDays', offset_days,
    'scheduleAnchor', schedule_anchor,
    'offsetUnit', offset_unit,
    'functionalRole', functional_role,
    'isRequired', is_required,
    'blocksHandoff', blocks_handoff,
    'stage', stage,
    'sortOrder', sort_order
  ) ORDER BY sort_order, id), '[]'::jsonb)
  INTO _before
  FROM bulk_template_effective;

  IF _changed_count > 0 THEN
    UPDATE public.onboarding_template_tasks t
    SET
      offset_days = CASE WHEN _set_due_rule THEN _offset_days ELSE t.offset_days END,
      schedule_anchor = CASE WHEN _set_due_rule THEN _schedule_anchor ELSE t.schedule_anchor END,
      offset_unit = CASE WHEN _set_offset_unit THEN _offset_unit ELSE t.offset_unit END,
      functional_role = CASE WHEN _set_functional_role THEN _functional_role ELSE t.functional_role END,
      role = CASE WHEN _set_functional_role THEN _role_label ELSE t.role END,
      is_required = CASE WHEN _set_is_required THEN _is_required ELSE t.is_required END,
      blocks_handoff = CASE WHEN _set_blocks_handoff THEN _blocks_handoff ELSE t.blocks_handoff END,
      stage = CASE WHEN _set_stage THEN _stage ELSE t.stage END,
      sort_order = COALESCE(e.new_sort_order, t.sort_order)
    FROM bulk_template_effective e
    WHERE t.id = e.id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'stepId', t.id,
      'title', t.title,
      'offsetDays', t.offset_days,
      'scheduleAnchor', t.schedule_anchor,
      'offsetUnit', t.offset_unit,
      'functionalRole', t.functional_role,
      'isRequired', t.is_required,
      'blocksHandoff', t.blocks_handoff,
      'stage', t.stage,
      'sortOrder', t.sort_order
    ) ORDER BY e.sort_order, e.id), '[]'::jsonb)
    INTO _after
    FROM public.onboarding_template_tasks t
    JOIN bulk_template_effective e ON e.id = t.id;

    _patch := jsonb_build_object(
      'dueRule', CASE WHEN _set_due_rule THEN jsonb_build_object('offsetDays', _offset_days, 'scheduleAnchor', _schedule_anchor) ELSE NULL END,
      'offsetUnit', CASE WHEN _set_offset_unit THEN to_jsonb(_offset_unit) ELSE NULL END,
      'functionalRole', CASE WHEN _set_functional_role THEN to_jsonb(_functional_role) ELSE NULL END,
      'isRequired', CASE WHEN _set_is_required THEN to_jsonb(_is_required) ELSE NULL END,
      'blocksHandoff', CASE WHEN _set_blocks_handoff THEN to_jsonb(_blocks_handoff) ELSE NULL END,
      'stage', CASE WHEN _set_stage THEN to_jsonb(_stage) ELSE NULL END
    );

    PERFORM private.write_onboarding_template_bulk_audit(
      _actor,
      _template_id,
      _template.name,
      jsonb_build_object('steps', _before),
      jsonb_build_object('steps', _after, 'patch', _patch, 'skipped', _skipped)
    );
  ELSE
    _after := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'changed', _changed_count,
    'skipped', _skipped,
    'auditRecorded', _changed_count > 0
  );
END $function$;

CREATE OR REPLACE FUNCTION public.plan_catch_up_tasks(_property_id uuid, _task_ids uuid[], _action text, _reason text DEFAULT NULL::text, _role text DEFAULT NULL::text, _person uuid DEFAULT NULL::uuid, _due_on date DEFAULT NULL::date, _dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _project public.onboarding_projects%ROWTYPE;
  _reason_clean text := btrim(COALESCE(_reason, ''));
  _can_reopen_any boolean;
  _held jsonb := '[]'::jsonb;
  _ready jsonb := '[]'::jsonb;
  _saved jsonb := '[]'::jsonb;
  _covered jsonb := '[]'::jsonb;
  _rows jsonb := '[]'::jsonb;
  _cards jsonb;
  _before jsonb;
  _n integer;
  _batch uuid;
  _prior text;
  _next text;
  s record;
  t public.onboarding_tasks%ROWTYPE;
BEGIN
  IF _actor IS NULL OR NOT private.plan_catch_up_gate(_actor) THEN
    RAISE EXCEPTION 'Only onboarding staff can update these Tasks.';
  END IF;
  IF _action NOT IN ('not_needed', 'assign', 'due_date', 'reopen') THEN RAISE EXCEPTION 'Choose what to change.'; END IF;
  _task_ids := COALESCE((SELECT array_agg(DISTINCT id) FROM unnest(_task_ids) ids(id)), '{}'::uuid[]);
  IF cardinality(_task_ids) = 0 THEN RAISE EXCEPTION 'Select at least one Task.'; END IF;
  IF cardinality(_task_ids) > 200 THEN RAISE EXCEPTION 'Select 200 Tasks or fewer at a time.'; END IF;
  IF NOT _dry_run THEN
    IF _action IN ('not_needed', 'reopen') AND char_length(_reason_clean) < 3 THEN
      RAISE EXCEPTION 'Add a reason (at least 3 characters).';
    END IF;
    IF _action = 'assign' AND ((_role IS NULL) = (_person IS NULL)) THEN RAISE EXCEPTION 'Choose one person or one role.'; END IF;
    IF _action = 'assign' AND _role IS NOT NULL AND _role <> ALL (ARRAY['onboarding_director', 'onboarding_manager',
       'onboarding_project_manager', 'utilities', 'lead_designer', 'designer', 'staging_team']) THEN
      RAISE EXCEPTION 'Choose an onboarding role.';
    END IF;
    IF _action = 'assign' AND _person IS NOT NULL AND NOT private.plan_catch_up_gate(_person) THEN
      RAISE EXCEPTION 'Choose someone on the onboarding team.';
    END IF;
    IF _action = 'due_date' AND _due_on IS NULL THEN RAISE EXCEPTION 'Pick a due date.'; END IF;
  END IF;

  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Start the onboarding project before changing its Tasks.'; END IF;
  IF private.onboarding_work_locked(ARRAY[_property_id]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked. Reopen a task with a reason instead.';
  END IF;
  _can_reopen_any := public.has_role(_actor, 'admin') OR COALESCE(public.is_onboarding_director(_actor), false);

  PERFORM 1 FROM public.onboarding_tasks WHERE property_id = _property_id AND id = ANY(_task_ids) FOR UPDATE;
  DROP TABLE IF EXISTS pg_temp.plan_catch_up_selected;
  CREATE TEMPORARY TABLE plan_catch_up_selected ON COMMIT DROP AS
  SELECT ot.id, ot.title, ot.sort_order,
    CASE
      WHEN ot.archived_at IS NOT NULL THEN 'Already not needed.'
      WHEN ot.exception_at IS NOT NULL THEN 'Recorded as an exception.'
      WHEN NOT private.plan_catch_up_can(_actor, _project.project_manager, ot.assigned_to, ot.assigned_seat)
        THEN 'Not assigned to you or your role.'
      WHEN _action = 'reopen' AND ot.status IS DISTINCT FROM 'complete' THEN 'Not finished.'
      WHEN _action = 'reopen' AND NOT _can_reopen_any AND ot.completed_by IS DISTINCT FROM _actor
        THEN 'Only an Admin, the Director of Onboarding or the person who finished it can reopen it.'
      WHEN _action <> 'reopen' AND ot.status IN ('complete', 'done', 'carryover') THEN 'Already done. Reopen it first.'
      WHEN _action = 'not_needed' AND private.plan_catch_up_bz_sent(ot.id) THEN 'A Breezeway work order was already sent for it.'
      WHEN _action = 'not_needed' AND private.plan_catch_up_owner_asked(ot.id) THEN 'Already sent to the homeowner.'
      WHEN (SELECT e.new_value::jsonb->>'status' FROM public.onboarding_project_events e
            WHERE e.project_id = _project.id AND e.kind = 'stage_capture:' || ot.stage
            ORDER BY (e.new_value::jsonb->>'revision')::integer DESC LIMIT 1) IN ('complete', 'awaiting_review')
        THEN 'Its stage is under review or complete. Return or reopen the stage first.'
      ELSE NULL
    END AS held_reason
  FROM public.onboarding_tasks ot
  WHERE ot.property_id = _property_id AND ot.id = ANY(_task_ids);

  SELECT count(*) INTO _n FROM plan_catch_up_selected;
  IF _n <> cardinality(_task_ids) THEN
    RAISE EXCEPTION 'Some selected Tasks are not on this home''s plan. Refresh and try again.';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title, 'reason', held_reason) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _held FROM plan_catch_up_selected WHERE held_reason IS NOT NULL;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _ready FROM plan_catch_up_selected WHERE held_reason IS NULL;

  IF _dry_run THEN
    RETURN jsonb_build_object('ready', _ready, 'held', _held, 'done', 0,
      'covered', CASE WHEN _action = 'not_needed' THEN private.plan_catch_up_cards(_actor, _property_id,
        COALESCE((SELECT array_agg(id) FROM plan_catch_up_selected WHERE held_reason IS NULL), '{}'::uuid[]),
        'task_not_needed', false) ELSE '[]'::jsonb END);
  END IF;

  FOR s IN SELECT * FROM plan_catch_up_selected WHERE held_reason IS NULL ORDER BY sort_order, id LOOP
    BEGIN
      SELECT * INTO t FROM public.onboarding_tasks WHERE id = s.id FOR UPDATE;
      _before := private.plan_catch_up_state(to_jsonb(t));
      _cards := '[]'::jsonb;
      IF _action = 'not_needed' THEN
        _cards := private.plan_catch_up_cards(_actor, _property_id, ARRAY[s.id], 'task_not_needed', true);
        UPDATE public.onboarding_tasks SET archived_at = now(), archived_by = _actor,
          exception_reason = 'Voided — not needed: ' || _reason_clean, exception_by = _actor, exception_at = now()
        WHERE id = s.id;
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_not_needed', 'Not needed for this home: "' || s.title || '"', _reason_clean,
                _actor, COALESCE(t.is_demo, false));
      ELSIF _action = 'assign' THEN
        _prior := CASE WHEN t.assigned_to IS NOT NULL THEN private.plan_catch_up_person(t.assigned_to)
                       ELSE COALESCE(t.assigned_seat, 'Unassigned') END;
        IF _role IS NOT NULL THEN
          UPDATE public.onboarding_tasks SET assigned_seat = _role, assigned_to = NULL WHERE id = s.id;
          _next := _role;
        ELSE
          UPDATE public.onboarding_tasks SET assigned_to = _person WHERE id = s.id;
          _next := private.plan_catch_up_person(_person);
        END IF;
        _prior := COALESCE((SELECT fr.name FROM public.functional_roles fr WHERE fr.code = _prior), _prior);
        _next := COALESCE((SELECT fr.name FROM public.functional_roles fr WHERE fr.code = _next), _next);
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_assigned', 'Assigned "' || s.title || '"', 'From ' || _prior || ' to ' || _next,
                _prior, _next, _actor, COALESCE(t.is_demo, false));
      ELSIF _action = 'due_date' THEN
        UPDATE public.onboarding_tasks SET due_on = _due_on, due_on_overridden = true, due_on_source = 'manual' WHERE id = s.id;
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, prior_value, new_value, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_due_changed', 'Due date changed: "' || s.title || '"',
                COALESCE(to_char(t.due_on, 'Mon DD, YYYY'), 'No due date'), to_char(_due_on, 'Mon DD, YYYY'), _actor, COALESCE(t.is_demo, false));
      ELSE
        UPDATE public.onboarding_tasks SET status = 'open' WHERE id = s.id;
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_reopened', 'Reopened "' || s.title || '"', _reason_clean,
                CASE WHEN t.completed_at IS NOT NULL THEN 'Completed ' || to_char(t.completed_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') ELSE 'Complete' END,
                'Open', _actor, COALESCE(t.is_demo, false));
      END IF;
      SELECT * INTO t FROM public.onboarding_tasks WHERE id = s.id;
      _rows := _rows || jsonb_build_array(jsonb_build_object('taskId', s.id, 'title', s.title, 'before', _before,
        'after', private.plan_catch_up_state(to_jsonb(t))));
      _saved := _saved || jsonb_build_array(jsonb_build_object('taskId', s.id, 'title', s.title));
      _covered := _covered || _cards;
    EXCEPTION WHEN OTHERS THEN
      _held := _held || jsonb_build_array(jsonb_build_object('taskId', s.id, 'title', s.title, 'reason', SQLERRM));
    END;
  END LOOP;

  _n := jsonb_array_length(_saved);
  IF _n > 0 THEN
    _batch := private.plan_catch_up_record(_actor, _property_id, _project.id, _action,
      jsonb_build_object('reason', NULLIF(_reason_clean, ''), 'role', _role, 'person', _person, 'due_on', _due_on),
      _rows, _covered, COALESCE(_project.is_demo, false),
      CASE _action WHEN 'not_needed' THEN 'onboarding_task_archived' WHEN 'assign' THEN 'onboarding_task_bulk_assigned'
                   WHEN 'due_date' THEN 'onboarding_task_bulk_due_changed' ELSE 'onboarding_task_reopened' END,
      NULLIF(_reason_clean, ''));
  END IF;
  RETURN jsonb_build_object('ready', _saved, 'held', _held, 'done', _n, 'batchId', _batch, 'covered', _covered);
END $function$;

CREATE OR REPLACE FUNCTION private.review_role_person(_project_id uuid, _role text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT o.user_id FROM public.seat_override_at(_role, now()) o WHERE o.kind = 'cover'),
    public.project_role_assignee(_project_id, _role),
    CASE WHEN _role IN ('lead_designer','onboarding_manager') THEN public.seat_holder_at('onboarding_director', now()) END)
$function$;

CREATE OR REPLACE FUNCTION public.set_onboarding_project_stagers(_project_id uuid, _vendor_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); pr public.onboarding_projects; wanted uuid[] := coalesce(_vendor_ids, '{}'); before uuid[]; added int; removed int;
BEGIN
  IF NOT private.onboarding_home_lead(me) THEN RAISE EXCEPTION 'Only the Director of Onboarding or an Admin can do this.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(wanted) v WHERE NOT EXISTS (
       SELECT 1 FROM public.vendor_orgs o WHERE o.id = v AND 'Staging' = ANY(o.service_categories))) THEN
    RAISE EXCEPTION 'Pick a stager from the staging vendors.';
  END IF;
  SELECT coalesce(array_agg(vendor_org_id ORDER BY vendor_org_id), '{}') INTO before
    FROM public.onboarding_project_stagers WHERE project_id = pr.id AND removed_at IS NULL;
  UPDATE public.onboarding_project_stagers SET removed_at = now(), removed_by = me
   WHERE project_id = pr.id AND removed_at IS NULL AND NOT (vendor_org_id = ANY(wanted));
  GET DIAGNOSTICS removed = ROW_COUNT;
  INSERT INTO public.onboarding_project_stagers(project_id, vendor_org_id, added_by)
  SELECT pr.id, v, me FROM (SELECT DISTINCT unnest(wanted) v) w
   WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_project_stagers s WHERE s.project_id = pr.id AND s.vendor_org_id = w.v AND s.removed_at IS NULL);
  GET DIAGNOSTICS added = ROW_COUNT;
  IF added + removed > 0 THEN
    INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, prior_value, new_value, actor, is_demo)
    VALUES (pr.id, pr.property_id, 'stagers_changed', 'Stager changed', array_to_string(before, ','), array_to_string(wanted, ','), me, coalesce(pr.is_demo, false));
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
    VALUES (me, 'onboarding.stagers_changed', 'onboarding_project', pr.id, 'Stager', to_jsonb(before), to_jsonb(wanted));
  END IF;
  RETURN jsonb_build_object('ok', true, 'added', added, 'removed', removed);
END $function$;
