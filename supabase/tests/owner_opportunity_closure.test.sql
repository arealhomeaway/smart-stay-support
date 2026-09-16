BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo,started_on)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false,current_date-5);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included',current_date-5);
INSERT INTO tickets(id,property_id,is_demo) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',false);
INSERT INTO owner_reviews(id,program_id,property_id,status,is_demo,title)
 VALUES('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','awaiting_owner',false,'Manual participation');
INSERT INTO owner_time_entries(id,program_id,owner_user_id,review_id,minutes,is_demo)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777',12,false);
INSERT INTO owner_time_entry_properties(entry_id,property_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');

SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; reason text; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 FOREACH reason IN ARRAY ARRAY[NULL,'','x',repeat('a',501)] LOOP
  BEGIN
   PERFORM close_owner_opportunity(r.id,r.updated_at,reason);
   RAISE EXCEPTION 'invalid closure reason accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Explain why%' THEN RAISE; END IF; END;
 END LOOP;
 BEGIN
  PERFORM close_owner_opportunity(r.id,'2000-01-01T00:00:00Z','Work no longer needed');
  RAISE EXCEPTION 'stale closure accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The opportunity changed%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM close_owner_opportunity(r.id,NULL,'Missing reviewed version');
  RAISE EXCEPTION 'unversioned closure accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The opportunity changed%' THEN RAISE; END IF; END;
 SELECT * INTO r FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666';
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Work no longer needed');
  RAISE EXCEPTION 'automatic Ticket opportunity closed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Ticket opportunities stay available%' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE id=r.id AND status='awaiting_owner' AND auto_ticket) THEN RAISE EXCEPTION 'automatic opportunity lost'; END IF;
 -- Pre-automation Ticket opportunities also remain reviewable.
 UPDATE owner_reviews SET auto_ticket=false WHERE id=r.id;
 SELECT * INTO r FROM owner_reviews WHERE id=r.id;
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Legacy linked Ticket');
  RAISE EXCEPTION 'legacy Ticket opportunity closed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Ticket opportunities stay available%' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE id=r.id AND status='awaiting_owner' AND ticket_id=r.ticket_id) THEN RAISE EXCEPTION 'legacy Ticket opportunity lost'; END IF;
 IF has_function_privilege('anon','close_owner_opportunity(uuid,timestamptz,text)','EXECUTE') THEN RAISE EXCEPTION 'anonymous closure privilege'; END IF;
END $$;
RESET ROLE;

-- Owners cannot call the endpoint even when they own the opportunity's program.
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Owner bypass attempt');
  RAISE EXCEPTION 'owner called staff closure';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Only staff may close participation opportunities.' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);

-- Reject responses/history that became final before closure.
UPDATE owner_reviews SET status='answered',responded_at=now(),owner_response='Recorded response' WHERE id='77777777-7777-4777-8777-777777777777';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Cannot erase a response');
  RAISE EXCEPTION 'answered opportunity withdrawn';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This opportunity already has an owner response%' THEN RAISE; END IF; END;
 UPDATE owner_reviews SET status='returned' WHERE id=r.id;
 SELECT * INTO r FROM owner_reviews WHERE id=r.id;
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Cannot erase a returned response');
  RAISE EXCEPTION 'returned response withdrawn';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This opportunity already has an owner response%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE owner_reviews SET status='awaiting_owner',responded_at=NULL,owner_response=NULL WHERE id='77777777-7777-4777-8777-777777777777';
UPDATE owner_programs SET status='completed' WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Program changed before closure');
  RAISE EXCEPTION 'completed program changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This participation program is no longer open%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE owner_programs SET status='active' WHERE id='55555555-5555-4555-8555-555555555555';

UPDATE owner_programs SET archived_at=now() WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Archived before closure');
  RAISE EXCEPTION 'archived program changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This participation program is no longer open%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE owner_programs SET archived_at=NULL WHERE id='55555555-5555-4555-8555-555555555555';
UPDATE owner_reviews SET is_demo=true WHERE id='77777777-7777-4777-8777-777777777777';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Mismatched demo context');
  RAISE EXCEPTION 'mixed demo opportunity closed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This opportunity does not match its program.' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE owner_reviews SET is_demo=false WHERE id='77777777-7777-4777-8777-777777777777';

-- History failure must roll the status and close timestamp back together.
CREATE FUNCTION fail_opportunity_close_history() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.kind='opportunity_closed' THEN RAISE EXCEPTION 'forced closure history failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fail_opportunity_close_history BEFORE INSERT ON owner_program_events
 FOR EACH ROW EXECUTE FUNCTION fail_opportunity_close_history();
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Work no longer needed');
  RAISE EXCEPTION 'closure history failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced closure history failure' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE id=r.id AND status='awaiting_owner' AND closed_at IS NULL AND updated_at=r.updated_at) THEN
  RAISE EXCEPTION 'closure survived failed history';
 END IF;
END $$;
RESET ROLE;
DROP TRIGGER fail_opportunity_close_history ON owner_program_events;

SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; closed uuid; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE id='77777777-7777-4777-8777-777777777777';
 closed:=close_owner_opportunity(r.id,r.updated_at,'Work no longer needed');
 IF closed IS DISTINCT FROM r.id OR NOT EXISTS(SELECT 1 FROM owner_reviews WHERE id=r.id AND status='closed' AND closed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'staff closure not recorded';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE review_id=r.id AND program_id=r.program_id AND property_id=r.property_id
  AND kind='opportunity_closed' AND actor_id=auth.uid() AND reason='Work no longer needed' AND previous_value='awaiting_owner' AND new_value='closed') THEN
  RAISE EXCEPTION 'closure receipt missing canonical links or provenance';
 END IF;
 SELECT * INTO r FROM owner_reviews WHERE id=r.id;
 BEGIN
  PERFORM close_owner_opportunity(r.id,r.updated_at,'Duplicate closure');
  RAISE EXCEPTION 'duplicate closure accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This opportunity is already closed.' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_program_events WHERE review_id=r.id AND kind='opportunity_closed')<>1 THEN RAISE EXCEPTION 'duplicate closure history'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries e JOIN owner_time_entry_properties p ON p.entry_id=e.id
  WHERE e.id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND e.review_id='77777777-7777-4777-8777-777777777777' AND e.minutes=12
  AND p.property_id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'closure lost historical time or property links'; END IF;
END $$;
ROLLBACK;
