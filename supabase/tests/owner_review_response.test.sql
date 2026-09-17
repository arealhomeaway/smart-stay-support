BEGIN;
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999','active',false);
INSERT INTO owner_reviews(id,program_id,status,auto_ticket,updated_at) VALUES('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','awaiting_owner',true,'2026-09-15T00:00:00Z');
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT respond_owner_review('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','acknowledged','Reviewed the work');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE owner_response='Reviewed the work' AND status='awaiting_owner') THEN RAISE EXCEPTION 'response changed operational status'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE kind='owner_participation_response' AND detail->>'response'='Reviewed the work') THEN RAISE EXCEPTION 'response history missing'; END IF;
 BEGIN
  PERFORM respond_owner_review('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','acknowledged','stale');
  RAISE EXCEPTION 'stale response accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The opportunity changed%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
DO $$ BEGIN
 BEGIN
  PERFORM respond_owner_review('77777777-7777-4777-8777-777777777777',now(),'acknowledged','other owner');
  RAISE EXCEPTION 'cross-owner response accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This opportunity is not available.' THEN RAISE; END IF; END;
END $$;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
DO $$ DECLARE version timestamptz; BEGIN
 SELECT updated_at INTO version FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM respond_owner_review('77777777-7777-4777-8777-777777777777',version,'approved','not a repair approval');
  RAISE EXCEPTION 'approval forged';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Use the canonical approval%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
CREATE FUNCTION fail_review_response_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced history failure'; END $$;
CREATE TRIGGER fail_review_history BEFORE INSERT ON owner_program_events FOR EACH ROW EXECUTE FUNCTION fail_review_response_history();
SET LOCAL ROLE authenticated;
DO $$ DECLARE version timestamptz; BEGIN
 SELECT updated_at INTO version FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM respond_owner_review('77777777-7777-4777-8777-777777777777',version,'acknowledged','must roll back');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced history failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM owner_reviews WHERE owner_response='must roll back') THEN RAISE EXCEPTION 'partial response persisted'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
