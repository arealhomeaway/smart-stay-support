-- Template bulk edit v2: conditions, homeowner need, active. New functions only; nothing replaced.
CREATE FUNCTION public.bulk_update_onboarding_template_steps_v2(
  _template_id uuid, _step_ids uuid[],
  _set_condition boolean DEFAULT false, _condition jsonb DEFAULT NULL,
  _set_owner_dependency boolean DEFAULT false, _owner_dependency text DEFAULT NULL,
  _set_is_active boolean DEFAULT false, _is_active boolean DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _template public.onboarding_templates%ROWTYPE;
  _count integer;
  _changed integer;
  _before jsonb;
  _after jsonb;
  _skipped jsonb;
  _clause jsonb;
BEGIN
  IF _actor IS NULL OR NOT private.is_onboarding_leader(_actor) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or a Supervisor can change templates.';
  END IF;
  SELECT * INTO _template FROM public.onboarding_templates WHERE id = _template_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That template no longer exists.'; END IF;
  _step_ids := COALESCE((SELECT array_agg(DISTINCT id) FROM unnest(_step_ids) AS ids(id)), '{}'::uuid[]);
  IF cardinality(_step_ids) = 0 THEN RAISE EXCEPTION 'Select at least one step.'; END IF;
  IF NOT (_set_condition OR _set_owner_dependency OR _set_is_active) THEN RAISE EXCEPTION 'Choose at least one change.'; END IF;

  IF _set_condition AND _condition IS NOT NULL THEN
    IF jsonb_typeof(_condition) <> 'object' OR jsonb_typeof(_condition->'all') <> 'array' OR jsonb_array_length(_condition->'all') = 0 THEN
      RAISE EXCEPTION 'Choose at least one condition, or clear the condition.';
    END IF;
    FOR _clause IN SELECT * FROM jsonb_array_elements(_condition->'all') LOOP
      IF NOT ((_clause->>'field' = 'furnishing_scope' AND _clause->>'value' IN ('full_furnishing','owner_furnished','no_furnishing'))
           OR (_clause->>'field' = 'module' AND _clause->>'value' IN ('pool','hoa','new_appliances','existing_appliances','smart_lock','cameras','landscaping','active_owner'))) THEN
        RAISE EXCEPTION 'Unsupported condition.';
      END IF;
    END LOOP;
    _condition := jsonb_build_object('all', _condition->'all');
  END IF;
  IF _set_owner_dependency AND (_owner_dependency IS NULL OR _owner_dependency NOT IN ('none','information','feedback','acknowledge','business_decision')) THEN
    RAISE EXCEPTION 'Choose what is needed from the homeowner.';
  END IF;
  IF _set_is_active AND _is_active IS NULL THEN RAISE EXCEPTION 'Choose active or inactive.'; END IF;

  PERFORM 1 FROM public.onboarding_template_tasks WHERE template_id = _template_id AND id = ANY(_step_ids) FOR UPDATE;
  SELECT count(*) INTO _count FROM public.onboarding_template_tasks WHERE template_id = _template_id AND id = ANY(_step_ids);
  IF _count <> cardinality(_step_ids) THEN
    RAISE EXCEPTION 'Some selected steps are no longer in this template. Refresh and try again.';
  END IF;

  -- A Business Decision makes the step need homeowner approval, which never blocks handoff.
  -- Steps that block handoff are skipped, never silently changed.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('stepId', id, 'title', title, 'reason', 'Turn off Blocks handoff before making this a Business Decision.') ORDER BY sort_order, id), '[]'::jsonb)
  INTO _skipped
  FROM public.onboarding_template_tasks
  WHERE template_id = _template_id AND id = ANY(_step_ids)
    AND _set_owner_dependency AND _owner_dependency = 'business_decision' AND blocks_handoff;

  CREATE TEMPORARY TABLE bulk_template_v2 ON COMMIT DROP AS
  SELECT id, title, sort_order, condition, owner_dependency, requires_owner_approval, is_active
  FROM public.onboarding_template_tasks t
  WHERE template_id = _template_id AND id = ANY(_step_ids)
    AND NOT (_set_owner_dependency AND _owner_dependency = 'business_decision' AND blocks_handoff)
    AND ((_set_condition AND t.condition IS DISTINCT FROM _condition)
      OR (_set_owner_dependency AND t.owner_dependency IS DISTINCT FROM NULLIF(_owner_dependency, 'none'))
      OR (_set_is_active AND t.is_active IS DISTINCT FROM _is_active));
  SELECT count(*) INTO _changed FROM bulk_template_v2;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('stepId', id, 'title', title, 'condition', condition, 'ownerDependency', owner_dependency,
    'requiresOwnerApproval', requires_owner_approval, 'isActive', is_active) ORDER BY sort_order, id), '[]'::jsonb)
  INTO _before FROM bulk_template_v2;

  IF _changed > 0 THEN
    UPDATE public.onboarding_template_tasks t SET
      condition = CASE WHEN _set_condition THEN _condition ELSE t.condition END,
      owner_dependency = CASE WHEN _set_owner_dependency THEN NULLIF(_owner_dependency, 'none') ELSE t.owner_dependency END,
      requires_owner_approval = CASE WHEN _set_owner_dependency THEN (_owner_dependency = 'business_decision' OR COALESCE(t.requires_owner_approval, false)) ELSE t.requires_owner_approval END,
      is_active = CASE WHEN _set_is_active THEN _is_active ELSE t.is_active END
    FROM bulk_template_v2 e WHERE t.id = e.id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('stepId', t.id, 'title', t.title, 'condition', t.condition, 'ownerDependency', t.owner_dependency,
      'requiresOwnerApproval', t.requires_owner_approval, 'isActive', t.is_active) ORDER BY e.sort_order, e.id), '[]'::jsonb)
    INTO _after FROM public.onboarding_template_tasks t JOIN bulk_template_v2 e ON e.id = t.id;

    PERFORM private.write_onboarding_template_bulk_audit(_actor, _template_id, _template.name,
      jsonb_build_object('steps', _before),
      jsonb_build_object('steps', _after, 'patch', jsonb_build_object(
        'condition', CASE WHEN _set_condition THEN COALESCE(_condition, 'null'::jsonb) END,
        'ownerDependency', CASE WHEN _set_owner_dependency THEN to_jsonb(_owner_dependency) END,
        'isActive', CASE WHEN _set_is_active THEN to_jsonb(_is_active) END), 'skipped', _skipped));
  END IF;
  DROP TABLE bulk_template_v2;
  RETURN jsonb_build_object('changed', _changed, 'skipped', _skipped, 'auditRecorded', _changed > 0);
END $function$;

CREATE FUNCTION public.template_bulk_v2_ready() RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$ SELECT true $$;

REVOKE ALL ON FUNCTION public.bulk_update_onboarding_template_steps_v2(uuid, uuid[], boolean, jsonb, boolean, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_onboarding_template_steps_v2(uuid, uuid[], boolean, jsonb, boolean, text, boolean, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.template_bulk_v2_ready() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_bulk_v2_ready() TO authenticated, service_role;
