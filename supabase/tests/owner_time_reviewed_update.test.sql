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
DO $$ DECLARE payload jsonb; entry uuid; BEGIN
 payload:=jsonb_build_object('programId','55555555-5555-4555-8555-555555555555','reviewId',(SELECT id FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666'),'ticketId','66666666-6666-4666-8666-666666666666','phase','ongoing','entryDate',current_date,'minutes',15,'activity','Reviewed the initial repair','ownerUpdateRevision',1,'owner_update_snapshot',jsonb_build_object('issue','FORGED'));
 entry:=log_owner_time_entry(payload,ARRAY['33333333-3333-4333-8333-333333333333'::uuid]);
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=entry AND owner_update_revision=1 AND owner_update_snapshot->>'work_performed'='Initial repair was performed.') THEN RAISE EXCEPTION 'displayed revision not retained'; END IF;
 IF EXISTS(SELECT 1 FROM owner_time_entries WHERE owner_update_snapshot::text LIKE '%FORGED%') THEN RAISE EXCEPTION 'client snapshot trusted'; END IF;
 BEGIN
  PERFORM log_owner_time_entry(payload || jsonb_build_object('ownerUpdateRevision',999),ARRAY['33333333-3333-4333-8333-333333333333'::uuid]);
  RAISE EXCEPTION 'nonexistent revision accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Choose the owner update%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_time_entries)<>1 THEN RAISE EXCEPTION 'failed revision left an entry'; END IF;
END $$;
RESET ROLE;
UPDATE owner_time_entries SET review_status='returned';
SET LOCAL ROLE authenticated;
DO $$ DECLARE amended uuid; BEGIN
 amended:=resubmit_owner_time_entry((SELECT id FROM owner_time_entries LIMIT 1),12,'Reviewed the initial repair','Corrected elapsed minutes');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=amended AND owner_update_revision=1 AND owner_update_snapshot->>'outcome'='Initial test passed.') THEN RAISE EXCEPTION 'owner correction lost reviewed revision'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE amended uuid; BEGIN
 amended:=correct_owner_time_entry((SELECT id FROM owner_time_entries WHERE amends_entry_id IS NOT NULL),'99999999-9999-4999-8999-999999999999',10,'Staff reviewed duration correction');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=amended AND owner_update_revision=1 AND owner_update_snapshot->>'outcome'='Initial test passed.') THEN RAISE EXCEPTION 'staff correction lost reviewed revision'; END IF;
 BEGIN
  UPDATE owner_time_entries SET owner_update_snapshot='{}';
  RAISE EXCEPTION 'immutable context changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The reviewed owner update is immutable%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_time_entries)<>3 THEN RAISE EXCEPTION 'correction history lost'; END IF;
END $$;
UPDATE owner_program_properties SET inclusion_status='removed';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_time_entries WHERE owner_update_snapshot->>'outcome'='Initial test passed.')<>3 THEN RAISE EXCEPTION 'historical context removed with enrollment'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
