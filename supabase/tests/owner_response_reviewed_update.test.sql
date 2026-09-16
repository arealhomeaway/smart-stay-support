BEGIN;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
INSERT INTO tickets(id,property_id,is_demo,title,description) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',false,'PRIVATE guest','PRIVATE code');
UPDATE owner_programs SET started_on=current_date-5;
UPDATE owner_program_properties SET closing_date=current_date-5;
SELECT save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','2026-09-15T00:00:00Z',0,'11111111-1111-4111-8111-111111111111','A pipe was leaking.','Initial repair was performed.','Initial test passed.',true);
SELECT save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','2026-09-15T00:00:00Z',1,'11111111-1111-4111-8111-111111111111','A pipe was leaking.','A follow-up check was performed.','Follow-up test passed.',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;

DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666';
 PERFORM respond_owner_review(r.id,r.updated_at,'acknowledged','Reviewed first narrative',1);
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE review_id=r.id AND detail->'ownerUpdate'->>'work_performed'='Initial repair was performed.') THEN RAISE EXCEPTION 'original narrative not retained'; END IF;
 IF EXISTS(SELECT 1 FROM owner_program_events WHERE detail->'ownerUpdate' IS NOT NULL AND detail::text LIKE '%PRIVATE%') THEN RAISE EXCEPTION 'private Ticket data leaked'; END IF;
 SELECT * INTO r FROM owner_reviews WHERE id=r.id;
 BEGIN
  PERFORM respond_owner_review(r.id,r.updated_at,'acknowledged','Missing revision',999);
  RAISE EXCEPTION 'invalid revision accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The reviewed Ticket revision%' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM owner_reviews WHERE owner_response='Missing revision') THEN RAISE EXCEPTION 'failed revision changed response'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 BEGIN
  UPDATE owner_program_events SET detail='{}' WHERE kind='owner_participation_response';
  RAISE EXCEPTION 'receipt changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Participation response history is immutable.' THEN RAISE; END IF; END;
END $$;
CREATE FUNCTION fail_snapshot_response() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced receipt failure'; END $$;
CREATE TRIGGER fail_snapshot_response BEFORE INSERT ON owner_program_events FOR EACH ROW EXECUTE FUNCTION fail_snapshot_response();
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666';
 BEGIN
  PERFORM respond_owner_review(r.id,r.updated_at,'acknowledged','Rollback response',2);
  RAISE EXCEPTION 'receipt failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced receipt failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM owner_reviews WHERE owner_response='Rollback response') THEN RAISE EXCEPTION 'response survived failed receipt'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER fail_snapshot_response ON owner_program_events;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM read_owner_review_update((SELECT id FROM owner_reviews LIMIT 1),1);
  RAISE EXCEPTION 'another owner read a receipt revision';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This reviewed opportunity is not available.' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','read_owner_review_update(uuid,integer)','EXECUTE') THEN RAISE EXCEPTION 'anonymous receipt read'; END IF;
END $$;
RESET ROLE;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
UPDATE owner_program_properties SET inclusion_status='removed';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666';
 BEGIN
  PERFORM respond_owner_review(r.id,r.updated_at,'acknowledged','Removed home',1);
  RAISE EXCEPTION 'removed property accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The Ticket Property%' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE detail->'ownerUpdate'->>'revision'='1') THEN RAISE EXCEPTION 'historic receipt lost'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
