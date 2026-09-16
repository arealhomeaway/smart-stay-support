BEGIN;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false),
 ('33333333-3333-4333-8333-333333333334','22222222-2222-4222-8222-222222222222',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,started_on,is_demo) VALUES
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',current_date-5,false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included',current_date-5,true);
-- Historical self-assignment must not act as a vendor capability.
INSERT INTO tickets(id,property_id,is_demo,title,description,status,vendor_user_id) VALUES
 ('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',false,'PRIVATE guest','PRIVATE code','open','88888888-8888-4888-8888-888888888888'),
 ('66666666-6666-4666-8666-666666666667','33333333-3333-4333-8333-333333333334',false,'PRIVATE other owner','PRIVATE phone','open','44444444-4444-4444-8444-444444444444');
INSERT INTO ticket_activity VALUES('66666666-6666-4666-8666-666666666666','PRIVATE staff activity');
INSERT INTO ticket_steps VALUES('66666666-6666-4666-8666-666666666666','PRIVATE staff checklist');
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE safe jsonb; n integer; BEGIN
 IF EXISTS(SELECT 1 FROM tickets) OR EXISTS(SELECT 1 FROM ticket_activity) OR EXISTS(SELECT 1 FROM ticket_steps) THEN RAISE EXCEPTION 'owner raw operational access leaked'; END IF;
 SELECT to_jsonb(t) INTO safe FROM read_owner_tickets('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333334']::uuid[],false) t;
 IF safe IS NULL OR safe->>'id'<>'66666666-6666-4666-8666-666666666666' OR safe::text LIKE '%PRIVATE%' OR safe ? 'title' OR safe ? 'vendor_user_id' THEN RAISE EXCEPTION 'unsafe or missing projection'; END IF;
 IF EXISTS(SELECT 1 FROM read_owner_tickets('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333']::uuid[],true)) THEN RAISE EXCEPTION 'owner forged admin preview'; END IF;
 BEGIN
  INSERT INTO tickets(property_id,title,vendor_user_id) VALUES('33333333-3333-4333-8333-333333333333','forged assignment',auth.uid());
  RAISE EXCEPTION 'owner raw INSERT allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE tickets SET title='forged update'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'owner raw UPDATE allowed'; END IF;
END $$;
-- Legitimate owner creation and linked logging survive raw SELECT removal.
DO $$ DECLARE created record; entry uuid; payload jsonb; BEGIN
 SELECT * INTO created FROM create_owner_matter('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','inform','Loose railing','Please inspect','maintenance');
 IF created.ticket_id IS NULL OR created.ref IS NULL THEN RAISE EXCEPTION 'no safe receipt'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE ticket_id=created.ticket_id AND auto_ticket) THEN RAISE EXCEPTION 'automatic opportunity missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE detail->>'ticketId'=created.ticket_id::text AND kind='owner_matter_opened') THEN RAISE EXCEPTION 'creation history missing'; END IF;
 payload:=jsonb_build_object('programId','55555555-5555-4555-8555-555555555555','reviewId',(SELECT id FROM owner_reviews WHERE ticket_id=created.ticket_id),'ticketId',created.ticket_id,'phase','ongoing','entryDate',current_date,'minutes',15,'activity','Reviewed the property matter');
 entry:=log_owner_time_entry(payload,ARRAY['33333333-3333-4333-8333-333333333333'::uuid]);
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=entry AND ticket_id=created.ticket_id) THEN RAISE EXCEPTION 'linked logging failed'; END IF;
 BEGIN
  PERFORM log_owner_time_entry(payload-'ticketId',ARRAY['33333333-3333-4333-8333-333333333333'::uuid]);
  RAISE EXCEPTION 'Ticket link omitted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Time must retain%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM log_owner_time_entry(payload||jsonb_build_object('ticketId','66666666-6666-4666-8666-666666666666'),ARRAY['33333333-3333-4333-8333-333333333333'::uuid]);
  RAISE EXCEPTION 'Ticket substituted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Time must retain%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_time_entries)<>1 THEN RAISE EXCEPTION 'failed entry left history'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM tickets WHERE owner_submitted AND (vendor_user_id IS NOT NULL OR status<>'open' OR record_type<>'active_task' OR is_demo OR owner_submitted_by<>auth.uid() OR created_by<>auth.uid())) THEN RAISE EXCEPTION 'owner submission operational state invalid'; END IF;
END $$;
-- Any failure in history rolls the Ticket and generated opportunity back.
CREATE FUNCTION test_reject_owner_matter_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='owner_matter_opened' THEN RAISE EXCEPTION 'simulated event failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER test_matter_history_failure BEFORE INSERT ON owner_program_events FOR EACH ROW EXECUTE FUNCTION test_reject_owner_matter_event();
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM create_owner_matter('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','inform','Atomic failure','must rollback','maintenance');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'simulated event failure' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM tickets)<>3 OR (SELECT count(*) FROM owner_reviews)<>2 THEN RAISE EXCEPTION 'failed matter left partial Ticket/opportunity'; END IF; END $$;
DROP TRIGGER test_matter_history_failure ON owner_program_events;
-- Canonical scope rejects changed ownership, removal, inactive Owner, archives and demo.
DO $$ DECLARE scenario text; BEGIN
 FOREACH scenario IN ARRAY ARRAY['transferred','removed','inactive','archived','property-archived','enrollment-archived','enrollment-demo','demo','other-owner','anonymous'] LOOP
  IF scenario='transferred' THEN UPDATE properties SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='33333333-3333-4333-8333-333333333333';
  ELSIF scenario='removed' THEN UPDATE owner_program_properties SET inclusion_status='removed';
  ELSIF scenario='inactive' THEN UPDATE property_owners SET active=false;
  ELSIF scenario='archived' THEN UPDATE owner_programs SET archived_at=now();
  ELSIF scenario='property-archived' THEN UPDATE properties SET archived_at=now();
  ELSIF scenario='enrollment-archived' THEN UPDATE owner_program_properties SET archived_at=now();
  ELSIF scenario='enrollment-demo' THEN UPDATE owner_program_properties SET is_demo=true;
  ELSIF scenario='demo' THEN UPDATE tickets SET is_demo=true;
  ELSIF scenario='other-owner' THEN PERFORM set_config('test.actor','12121212-1212-4212-8212-121212121212',true);
  ELSE PERFORM set_config('test.actor','',true); END IF;
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM read_owner_tickets('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333']::uuid[],false)) THEN RAISE EXCEPTION 'scope leaked: %',scenario; END IF;
  IF scenario<>'demo' THEN
   BEGIN
    PERFORM create_owner_matter('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','inform','Unauthorized matter','','maintenance');
    RAISE EXCEPTION 'scope allowed create: %',scenario;
   EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'scope allowed%' THEN RAISE; END IF; END;
  END IF;
  RESET ROLE;
  PERFORM set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
  UPDATE properties SET owner_record_id='11111111-1111-4111-8111-111111111111' WHERE id='33333333-3333-4333-8333-333333333333';
  UPDATE properties SET archived_at=NULL;
  UPDATE owner_program_properties SET archived_at=NULL,is_demo=false;
  UPDATE property_owners SET active=true;
  UPDATE owner_program_properties SET inclusion_status='included';
  UPDATE owner_programs SET archived_at=NULL;
  UPDATE tickets SET is_demo=false;
 END LOOP;
 IF (SELECT count(*) FROM owner_time_entries)<>1 THEN RAISE EXCEPTION 'scope change deleted participation history'; END IF;
END $$;
-- Independent legitimate vendor and staff responsibilities retain their raw access.
SELECT set_config('test.actor','44444444-4444-4444-8444-444444444444',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM tickets)<>1 THEN RAISE EXCEPTION 'vendor assigned access broken'; END IF;
 UPDATE tickets SET status='in_progress'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'vendor update broken'; END IF;
 BEGIN
  UPDATE tickets SET vendor_user_id='88888888-8888-4888-8888-888888888888';
  RAISE EXCEPTION 'vendor reassigned its Ticket';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE tickets SET is_demo=true WHERE vendor_user_id=auth.uid();
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 UPDATE tickets SET status='resolved'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'vendor demo update permitted'; END IF;
END $$;
RESET ROLE;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM tickets)<>3 OR (SELECT count(*) FROM ticket_activity)<>1 OR (SELECT count(*) FROM ticket_steps)<>1 THEN RAISE EXCEPTION 'staff operational access broken'; END IF;
 UPDATE tickets SET status='in_progress' WHERE NOT is_demo; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'staff update broken'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
