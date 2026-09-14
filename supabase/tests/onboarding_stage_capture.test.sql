BEGIN;
SELECT set_config('test.staff', 'true', true);
INSERT INTO properties(id) VALUES ('22222222-2222-4222-8222-222222222222');
INSERT INTO onboarding_projects(id, property_id) VALUES
 ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222');
DO $$ DECLARE scope jsonb := '{"modules":[],"furnishing_scope":"full_furnishing","director":null}';
BEGIN
  PERFORM record_onboarding_stage_capture('44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111', 0,
    '{"stage":"phase1_inspection","revision":1,"status":"draft","observation":"Original","reason":""}', '[]', scope);
  PERFORM record_onboarding_stage_capture('44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111', 1,
    '{"stage":"phase1_inspection","revision":2,"status":"awaiting_review","observation":"Updated","reason":""}', '[]', scope);
  IF (SELECT count(*) FROM onboarding_project_events) <> 2 THEN RAISE EXCEPTION 'revision history missing'; END IF;
  IF (SELECT count(*) FROM onboarding_stage_captures) <> 1 THEN RAISE EXCEPTION 'multiple canonical captures'; END IF;
  IF (SELECT new_value::jsonb ->> 'observation' FROM onboarding_stage_captures) <> 'Updated' THEN RAISE EXCEPTION 'canonical capture is stale'; END IF;
  BEGIN
    PERFORM record_onboarding_stage_capture('44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111', 1,
      '{"stage":"phase1_inspection","revision":2,"status":"complete"}', '[]', scope);
    RAISE EXCEPTION 'stale review allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This stage changed. Refresh before saving.' THEN RAISE; END IF;
  END;
  INSERT INTO onboarding_tasks VALUES ('55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', 'phase1_inspection', null, 'open');
  BEGIN
    PERFORM record_onboarding_stage_capture('44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111', 2,
      '{"stage":"phase1_inspection","revision":3,"status":"complete"}', '[]', scope);
    RAISE EXCEPTION 'changed tasks allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Stage work changed. Refresh before saving.' THEN RAISE; END IF;
  END;
  UPDATE onboarding_projects SET furnishing_scope = 'no_furnishing';
  BEGIN
    PERFORM record_onboarding_stage_capture('44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111', 2,
      '{"stage":"phase1_inspection","revision":3,"status":"complete"}', '[]', scope);
    RAISE EXCEPTION 'changed scope allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Project scope changed. Refresh before saving.' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM onboarding_project_events) <> 2 THEN RAISE EXCEPTION 'failed write leaked an event'; END IF;
  IF has_function_privilege('authenticated', 'public.record_onboarding_stage_capture(uuid,uuid,integer,jsonb,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'untrusted caller can bypass stage validation';
  END IF;
END $$;
ROLLBACK;
