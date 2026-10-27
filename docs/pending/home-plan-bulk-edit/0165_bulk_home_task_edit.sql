-- PENDING, NOT APPLIED. Option A: all-or-nothing bulk edits to open Tasks on ONE home's onboarding plan.
-- The outer function stays SECURITY INVOKER so the existing onboarding_tasks RLS and triggers
-- (handoff lock, owner-work-never-blocks, stage history, work_items mirror) all still apply.
-- The small audit helper is the only privileged piece; it records per-Task history in the same transaction.
-- Never changes status, title, instructions, Opportunities, or completed/archived/exception Tasks.

CREATE OR REPLACE FUNCTION private.write_onboarding_task_bulk_audit(
  _actor_id uuid,
  _rows jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'A signed-in editor is required.';
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  SELECT _actor_id, 'onboarding_task_bulk_updated', 'onboarding_task',
         (r->>'taskId')::uuid, r->>'title', r->'before', r->'after'
  FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) AS r;
END $$;

REVOKE ALL ON FUNCTION private.write_onboarding_task_bulk_audit(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.write_onboarding_task_bulk_audit(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_update_onboarding_home_tasks(
  _property_id uuid,
  _task_ids uuid[],
  _set_due_on boolean DEFAULT false,
  _due_on date DEFAULT NULL,
  _set_offset_unit boolean DEFAULT false,
  _offset_unit text DEFAULT NULL,
  _set_role boolean DEFAULT false,
  _role text DEFAULT NULL,
  _set_is_required boolean DEFAULT false,
  _is_required boolean DEFAULT NULL,
  _set_blocks_handoff boolean DEFAULT false,
  _blocks_handoff boolean DEFAULT NULL,
  _set_stage boolean DEFAULT false,
  _stage text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.bulk_update_onboarding_home_tasks(uuid, uuid[], boolean, date, boolean, text, boolean, text, boolean, boolean, boolean, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_onboarding_home_tasks(uuid, uuid[], boolean, date, boolean, text, boolean, text, boolean, boolean, boolean, boolean, boolean, text) TO authenticated;
