BEGIN;
SELECT set_config('test.actor', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('test.staff', 'true', true);
SELECT set_config('test.supervisor', 'false', true);
INSERT INTO properties(id, lifecycle_status) VALUES ('22222222-2222-4222-8222-222222222222', 'handoff_requested');
INSERT INTO onboarding_projects(id,property_id,director) VALUES
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
INSERT INTO property_handoffs(id,property_id,status,gate_step,open_task_ids) VALUES
 ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','requested','kati_review',ARRAY['55555555-5555-4555-8555-555555555555']::uuid[]);
INSERT INTO onboarding_tasks(id,property_id,status) VALUES
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','open'),
 ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','open');
SELECT review_onboarding_handoff('88888888-8888-4888-8888-888888888888','kati_review','accepted');
DO $$ BEGIN
  BEGIN
    PERFORM review_onboarding_handoff('88888888-8888-4888-8888-888888888888','kati_review','accepted');
    RAISE EXCEPTION 'stale review allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'The handoff advanced.%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM review_onboarding_handoff('88888888-8888-4888-8888-888888888888','micah_review','accepted');
    RAISE EXCEPTION 'onboarding director approved Operations gate';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'You do not have access%' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('test.supervisor', 'true', true);
SELECT review_onboarding_handoff('88888888-8888-4888-8888-888888888888','micah_review','accepted');
SELECT review_onboarding_handoff('88888888-8888-4888-8888-888888888888','operations_acceptance','accepted');
DO $$ BEGIN
  IF (SELECT active FROM properties) OR (SELECT lifecycle_status FROM properties) = 'active_operations'
    THEN RAISE EXCEPTION 'acceptance prematurely made property Live'; END IF;
  IF (SELECT status FROM onboarding_tasks WHERE id='55555555-5555-4555-8555-555555555555') <> 'carryover'
    THEN RAISE EXCEPTION 'approved carryover missing'; END IF;
  IF (SELECT status FROM onboarding_tasks WHERE id='66666666-6666-4666-8666-666666666666') <> 'open'
    THEN RAISE EXCEPTION 'unapproved task converted to carryover'; END IF;
END $$;
ALTER TABLE properties ADD CONSTRAINT simulate_live_failure CHECK (NOT active);
DO $$ BEGIN
  BEGIN
    PERFORM review_onboarding_handoff('88888888-8888-4888-8888-888888888888','live_confirmation','accepted');
    RAISE EXCEPTION 'property failure ignored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM handoff_reviews) <> 3 OR
    (SELECT gate_step FROM property_handoffs) <> 'live_confirmation' THEN RAISE EXCEPTION 'partial review saved'; END IF;
END $$;
ALTER TABLE properties DROP CONSTRAINT simulate_live_failure;
SELECT review_onboarding_handoff('88888888-8888-4888-8888-888888888888','live_confirmation','accepted');
DO $$ BEGIN
  IF NOT (SELECT active FROM properties) OR (SELECT status FROM onboarding_projects) <> 'complete'
    OR (SELECT count(*) FROM handoff_reviews) <> 4 THEN RAISE EXCEPTION 'Live transition incomplete'; END IF;
END $$;
ROLLBACK;
