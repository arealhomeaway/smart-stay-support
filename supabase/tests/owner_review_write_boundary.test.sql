BEGIN;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','false',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo,started_on)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false,current_date-5);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included',current_date-5);
INSERT INTO tickets(id,property_id,is_demo) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',false);

SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; affected integer; logged uuid; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666';
 IF r.id IS NULL THEN RAISE EXCEPTION 'owner lost opportunity SELECT'; END IF;
 UPDATE owner_reviews SET owner_response='Bypassed receipt',owner_decision='approve',status='closed',
  title='Forged title',auto_ticket=false,property_id=NULL,ticket_id=NULL WHERE id=r.id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'owner raw UPDATE bypassed atomic response'; END IF;
 IF EXISTS(SELECT 1 FROM owner_reviews WHERE id=r.id AND (owner_response IS NOT NULL OR NOT auto_ticket OR status<>'awaiting_owner')) THEN
  RAISE EXCEPTION 'owner changed protected opportunity fields';
 END IF;
 DELETE FROM owner_reviews WHERE id=r.id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'owner deleted opportunity'; END IF;
 BEGIN
  INSERT INTO owner_reviews(program_id,status) VALUES(r.program_id,'awaiting_owner');
  RAISE EXCEPTION 'owner created operational opportunity';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM respond_owner_review(r.id,r.updated_at,'acknowledged','Reviewed property work',NULL);
 IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE id=r.id AND owner_response='Reviewed property work') OR
  NOT EXISTS(SELECT 1 FROM owner_program_events WHERE review_id=r.id AND kind='owner_participation_response' AND detail->>'response'='Reviewed property work') THEN
  RAISE EXCEPTION 'canonical response and receipt no longer work';
 END IF;
 logged:=log_owner_time_entry(jsonb_build_object('programId',r.program_id,'reviewId',r.id,
  'ticketId',r.ticket_id,'entryDate',current_date,'minutes',15,'activity','Reviewed completed property work','phase','ongoing'),ARRAY[r.property_id]);
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=logged AND minutes=15) THEN RAISE EXCEPTION 'owner logging SELECT failed'; END IF;
END $$;
RESET ROLE;

-- Staff table writes retain the baseline RLS authorization.
SELECT set_config('test.staff','true',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
 UPDATE owner_reviews SET status='returned' WHERE ticket_id='66666666-6666-4666-8666-666666666666';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'staff opportunity management denied'; END IF;
END $$;
RESET ROLE;

-- Returning a time entry remains a separate staff action; the owner's invoker
-- correction copies historical evidence without needing review UPDATE rights.
UPDATE owner_time_entries SET review_status='returned';
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE original uuid; corrected uuid; BEGIN
 SELECT id INTO original FROM owner_time_entries WHERE review_id IS NOT NULL;
 corrected:=resubmit_owner_time_entry(original,12,'Reviewed completed property work','Corrected actual review duration');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=corrected AND amends_entry_id=original AND minutes=12) THEN
  RAISE EXCEPTION 'owner correction no longer works';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
