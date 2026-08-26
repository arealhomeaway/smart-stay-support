CREATE OR REPLACE FUNCTION public.seed_demo_onboarding(_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prop uuid;
  _t1 uuid;
  _t2 uuid;
  _handoff uuid;
BEGIN
  IF NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can seed the demo environment.';
  END IF;

  SELECT id INTO _prop FROM public.properties
   WHERE is_demo = true AND name = 'DEMO — Willow Creek Cottage' AND archived_at IS NULL
   LIMIT 1;

  IF _prop IS NULL THEN
    INSERT INTO public.properties (name, address_line1, city, state, postal_code, access_notes, lifecycle_status, onboarding_stage, is_demo, active)
    VALUES ('DEMO — Willow Creek Cottage', '1 Demo Lane', 'Demoville', 'TX', '77000',
            'Demo access: lockbox 0000. Practice data only.', 'onboarding', 'readiness', true, false)
    RETURNING id INTO _prop;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.onboarding_tasks WHERE property_id = _prop AND is_demo = true) THEN
    INSERT INTO public.onboarding_tasks (property_id, stage, title, detail, status, blocks_handoff, evidence_required, sort_order, is_demo, created_by)
    VALUES (_prop, 'intake', 'DEMO — Signed management agreement on file', 'Practice item.', 'complete', true, true, 1, true, _actor)
    RETURNING id INTO _t1;

    INSERT INTO public.onboarding_tasks (property_id, stage, title, detail, status, blocks_handoff, evidence_required, depends_on, sort_order, is_demo, created_by)
    VALUES (_prop, 'readiness', 'DEMO — Photograph every room for the listing', 'Blocked until utilities are on.', 'blocked', true, true, ARRAY[_t1], 2, true, _actor)
    RETURNING id INTO _t2;

    INSERT INTO public.onboarding_tasks (property_id, stage, title, detail, status, blocks_handoff, parent_task_id, sort_order, is_demo, created_by)
    VALUES (_prop, 'readiness', 'DEMO — Confirm electricity account transfer', 'Subtask of the photo task.', 'open', true, _t2, 3, true, _actor);

    INSERT INTO public.onboarding_notes (property_id, task_id, body, mentions, author_id, is_demo)
    VALUES (_prop, _t2, 'DEMO — Utility transfer is the only thing holding photos. Owner promised Friday.', ARRAY[]::uuid[], _actor, true);

    INSERT INTO public.property_handoffs (property_id, status, requested_by, checklist, validation, open_task_ids, carryover_accepted, gate_step, notes, is_demo)
    VALUES (_prop, 'requested', _actor, '[]'::jsonb, '{"ready": false}'::jsonb, ARRAY[_t2], true, 'kati_review',
            'DEMO — practice handoff. Utilities accepted as carryover.', true)
    RETURNING id INTO _handoff;
  END IF;

  INSERT INTO public.external_records (database_key, source, external_id, title, payload, match_status, is_demo)
  VALUES
    ('property_utility_matrix', 'notion', 'demo-utility-001', 'DEMO — Willow Creek utilities', '{"electric":"Demo Power","water":"Demo Water"}'::jsonb, 'unmatched', true),
    ('onboarding_intake', 'fillout', 'demo-intake-001', 'DEMO — Owner intake submission', '{"owner":"Demo Owner"}'::jsonb, 'unmatched', true)
  ON CONFLICT (database_key, external_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_demo_onboarding(_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can manage the demo environment.';
  END IF;

  UPDATE public.onboarding_tasks SET archived_at = now(), archived_by = _actor
   WHERE is_demo = true AND archived_at IS NULL;
  UPDATE public.onboarding_notes SET archived_at = now() WHERE is_demo = true AND archived_at IS NULL;
  UPDATE public.property_handoffs SET archived_at = now() WHERE is_demo = true AND archived_at IS NULL;
  UPDATE public.external_records SET archived_at = now(), match_status = 'archived'
   WHERE is_demo = true AND archived_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_demo_onboarding(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_demo_onboarding(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_onboarding(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_demo_onboarding(uuid) TO service_role;