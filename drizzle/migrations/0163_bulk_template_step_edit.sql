-- PENDING, NOT APPLIED. Help Ticket #56: all-or-nothing bulk edits to Workflow Template steps.
-- The outer function stays SECURITY INVOKER so the existing template RLS policies still apply.
-- The small audit helper is the only privileged piece; it records history in the same transaction.

CREATE OR REPLACE FUNCTION private.write_onboarding_template_bulk_audit(
  _actor_id uuid,
  _template_id uuid,
  _template_name text,
  _before jsonb,
  _after jsonb
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
  VALUES(
    _actor_id,
    'onboarding_template_steps_bulk_updated',
    'onboarding_template',
    _template_id,
    _template_name,
    _before,
    _after
  );
END $$;

REVOKE ALL ON FUNCTION private.write_onboarding_template_bulk_audit(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.write_onboarding_template_bulk_audit(uuid, uuid, text, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_update_onboarding_template_steps(
  _template_id uuid,
  _step_ids uuid[],
  _set_due_rule boolean DEFAULT false,
  _offset_days integer DEFAULT NULL,
  _schedule_anchor text DEFAULT NULL,
  _set_offset_unit boolean DEFAULT false,
  _offset_unit text DEFAULT NULL,
  _set_functional_role boolean DEFAULT false,
  _functional_role text DEFAULT NULL,
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
END $$;

REVOKE ALL ON FUNCTION public.bulk_update_onboarding_template_steps(uuid, uuid[], boolean, integer, text, boolean, text, boolean, text, boolean, boolean, boolean, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_onboarding_template_steps(uuid, uuid[], boolean, integer, text, boolean, text, boolean, text, boolean, boolean, boolean, boolean, boolean, text) TO authenticated;