-- Run in an isolated database after fixtures/onboarding_fact_review_schema.sql
-- and migrations/20260914010000_atomic_onboarding_fact_review.sql.
BEGIN;
SELECT set_config('test.actor', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('test.staff', 'true', true);
INSERT INTO properties(id, city) VALUES ('22222222-2222-4222-8222-222222222222', 'Before');
INSERT INTO property_fact_proposals(id, property_id, project_id, field_key, field_label, current_value, proposed_value)
VALUES ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444', 'city', 'City', 'Before', 'After');
SELECT review_onboarding_fact('33333333-3333-4333-8333-333333333333', true, 'Verified');
DO $$ BEGIN
  IF (SELECT city FROM properties) <> 'After' THEN RAISE EXCEPTION 'accept did not update'; END IF;
  IF (SELECT status FROM property_fact_proposals) <> 'accepted' THEN RAISE EXCEPTION 'decision missing'; END IF;
  IF (SELECT prior_value FROM onboarding_project_events) <> 'Before' THEN RAISE EXCEPTION 'history lost'; END IF;
  BEGIN
    PERFORM review_onboarding_fact('33333333-3333-4333-8333-333333333333', true);
    RAISE EXCEPTION 'duplicate review allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'That change has already been reviewed.' THEN RAISE; END IF;
  END;
END $$;
UPDATE property_fact_proposals SET status = 'pending', current_value = 'Stale';
DO $$ BEGIN
  BEGIN
    PERFORM review_onboarding_fact('33333333-3333-4333-8333-333333333333', true);
    RAISE EXCEPTION 'stale overwrite allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'The property changed after this proposal.%' THEN RAISE; END IF;
  END;
  IF (SELECT city FROM properties) <> 'After' THEN RAISE EXCEPTION 'stale write leaked'; END IF;
END $$;
UPDATE property_fact_proposals SET field_key = 'id';
DO $$ BEGIN
  BEGIN
    PERFORM review_onboarding_fact('33333333-3333-4333-8333-333333333333', true);
    RAISE EXCEPTION 'unapproved field allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This field cannot be changed through onboarding fact review.' THEN RAISE; END IF;
  END;
END $$;
UPDATE property_fact_proposals SET field_key = 'city', current_value = 'After', proposed_value = 'Rollback';
ALTER TABLE onboarding_project_events ADD CONSTRAINT simulate_history_failure CHECK (new_value <> 'Rollback');
DO $$ BEGIN
  BEGIN
    PERFORM review_onboarding_fact('33333333-3333-4333-8333-333333333333', true);
    RAISE EXCEPTION 'history failure allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT city FROM properties) <> 'After' THEN RAISE EXCEPTION 'partial property write'; END IF;
  IF (SELECT status FROM property_fact_proposals) <> 'pending' THEN RAISE EXCEPTION 'partial decision write'; END IF;
END $$;
SELECT set_config('test.staff', 'false', true);
DO $$ BEGIN
  BEGIN
    PERFORM review_onboarding_fact('33333333-3333-4333-8333-333333333333', true);
    RAISE EXCEPTION 'unauthorized review allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'You do not have access to review onboarding facts.' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('test.staff', 'true', true);
SELECT review_onboarding_fact('33333333-3333-4333-8333-333333333333', false, 'Keep verified value');
DO $$ BEGIN
  IF (SELECT city FROM properties) <> 'After' THEN RAISE EXCEPTION 'rejection changed property'; END IF;
  IF (SELECT status FROM property_fact_proposals) <> 'rejected' THEN RAISE EXCEPTION 'rejection missing'; END IF;
END $$;
ROLLBACK;
