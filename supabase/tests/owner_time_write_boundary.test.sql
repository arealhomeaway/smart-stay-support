BEGIN;
INSERT INTO auth.users(id) VALUES('88888888-8888-4888-8888-888888888888');
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','owner');
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false),
 ('33333333-3333-4333-8333-333333333334','11111111-1111-4111-8111-111111111111',false),
 ('33333333-3333-4333-8333-333333333335','22222222-2222-4222-8222-222222222222',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,started_on,is_demo) VALUES
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','draft',NULL,false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed,is_demo) VALUES
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included',current_date-5,true,false),
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333334','included',current_date-3,true,false);
UPDATE owner_programs SET status='active',started_on=current_date-3,ends_on=current_date+86 WHERE id='55555555-5555-4555-8555-555555555555';
INSERT INTO tickets(id,property_id,title,description,status,is_demo) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','PRIVATE guest','PRIVATE credential','open',false);
INSERT INTO owner_reviews(id,program_id,task_type,status,phase,is_demo) VALUES
 ('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','program_wide','awaiting_owner','ongoing',false),
 ('77777777-7777-4777-8777-777777777778','55555555-5555-4555-8555-555555555555','multi_property','awaiting_owner','ongoing',false);
INSERT INTO owner_review_properties(review_id,property_id) VALUES
 ('77777777-7777-4777-8777-777777777778','33333333-3333-4333-8333-333333333333'),
 ('77777777-7777-4777-8777-777777777778','33333333-3333-4333-8333-333333333334');
CREATE FUNCTION time_payload(_review uuid,_ticket uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('programId','55555555-5555-4555-8555-555555555555','reviewId',_review,'ticketId',_ticket,
 'phase','ongoing','entryDate',current_date,'minutes',15,'activity','Reviewed actual property work','confirmed',true,'output','Retained evidence','attachmentPath','owner/evidence.pdf')
$$;
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE e uuid; BEGIN
 e:=log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}');
 IF EXISTS(SELECT 1 FROM owner_time_entry_properties WHERE entry_id=e) THEN RAISE EXCEPTION 'program-wide time invented Property links'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=e AND attested AND minutes=15 AND review_status='submitted') THEN RAISE EXCEPTION 'valid program-wide log missing'; END IF;
 e:=log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333334']::uuid[]);
 IF (SELECT count(*) FROM owner_time_entry_properties WHERE entry_id=e)<>2 THEN RAISE EXCEPTION 'multi-Property links missing'; END IF;
 IF (SELECT sum(minutes) FROM owner_time_entries)<>30 THEN RAISE EXCEPTION 'shared time counted twice'; END IF;
END $$;
RESET ROLE;
-- Failures must preserve all participation rows, links, history and report state.
CREATE FUNCTION expect_time_failure(_command text,_message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE entries_before integer; links_before integer; events_before integer; audits_before integer; version_before uuid;
BEGIN
 SELECT count(*) INTO entries_before FROM owner_time_entries;
 SELECT count(*) INTO links_before FROM owner_time_entry_properties;
 SELECT count(*) INTO events_before FROM owner_program_events;
 SELECT count(*) INTO audits_before FROM audit_log;
 SELECT report_version INTO version_before FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 BEGIN EXECUTE _command; RAISE EXCEPTION 'Expected rejection but operation succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE _message THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_time_entries)<>entries_before OR (SELECT count(*) FROM owner_time_entry_properties)<>links_before
  OR (SELECT count(*) FROM owner_program_events)<>events_before OR (SELECT count(*) FROM audit_log)<>audits_before
  OR (SELECT report_version FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555') IS DISTINCT FROM version_before THEN
  RAISE EXCEPTION 'Rejected time operation left partial writes';
 END IF;
END $$;
CREATE FUNCTION boundary_entry() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM owner_time_entries WHERE amends_entry_id IS NULL ORDER BY id LIMIT 1 $$;

SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')-'confirmed','{}')$q$,'Confirm that this entry%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||'{"confirmed":"true"}','{}')$q$,'Confirm that this entry%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||jsonb_build_object('entryDate',current_date-4),'{}')$q$,'Choose a date from the program start%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||jsonb_build_object('entryDate',current_date+1),'{}')$q$,'Choose a date from the program start%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||'{"entryDate":"infinity"}','{}')$q$,'Choose a date from the program start%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||'{"minutes":0}','{}')$q$,'Enter the actual activity%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||'{"minutes":1441}','{}')$q$,'Enter the actual activity%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||'{"activity":"  "}','{}')$q$,'Enter the actual activity%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777')||'{"phase":"onboarding"}','{}')$q$,'Choose an available participation opportunity%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),'{}')$q$,'Select the opportunity properties%');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY[NULL]::uuid[])$q$,'Choose at most 25 valid opportunity properties.');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333335']::uuid[])$q$,'That Property is not assigned%');
-- Direct table insertion cannot avoid confirmation/eligibility; direct review has no UPDATE policy.
SELECT expect_time_failure($q$INSERT INTO owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity) VALUES('55555555-5555-4555-8555-555555555555',auth.uid(),'ongoing',current_date,99,'Bypass')$q$,'Record participation through its atomic%');
SELECT expect_time_failure($q$INSERT INTO owner_time_entry_properties(entry_id,property_id) VALUES(boundary_entry(),'33333333-3333-4333-8333-333333333335')$q$,'Link participation through its atomic%');
SELECT expect_time_failure($q$INSERT INTO owner_program_events(program_id,entry_id,kind,summary,actor_id) VALUES('55555555-5555-4555-8555-555555555555',boundary_entry(),'time_entry','Forged counted history',auth.uid())$q$,'Participation history must be recorded by its atomic action.');
DO $$ DECLARE changed integer; BEGIN
 UPDATE owner_time_entries SET minutes=999 WHERE id=boundary_entry(); GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'raw owner rewrote time'; END IF;
 UPDATE owner_time_entries SET review_status='approved' WHERE id=boundary_entry(); GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'raw owner approved time'; END IF;
 IF has_function_privilege('authenticated','correct_owner_time_entry(uuid,uuid,integer,text)','EXECUTE')
  OR has_function_privilege('anon','review_owner_time_entry(uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'unsafe correction/review grant'; END IF;
END $$;
SELECT expect_time_failure($q$SELECT review_owner_time_entry(boundary_entry(),NULL,'approved','')$q$,'Only an authorized supervisor%');
RESET ROLE;
-- Evidence/link/history guards also protect trusted table maintenance.
SELECT expect_time_failure($q$UPDATE owner_time_entries SET output='Rewritten evidence' WHERE id=boundary_entry()$q$,'Participation evidence is immutable%');
SELECT expect_time_failure($q$UPDATE owner_time_entry_properties SET property_id='33333333-3333-4333-8333-333333333335'$q$,'Historical participation Property links are immutable.');
SELECT expect_time_failure($q$DELETE FROM owner_time_entry_properties$q$,'Historical participation Property links are immutable.');
SELECT expect_time_failure($q$UPDATE owner_program_events SET summary='Rewritten history' WHERE kind='time_entry'$q$,'Participation history is immutable.');
SELECT expect_time_failure($q$DELETE FROM owner_program_events WHERE kind='time_entry'$q$,'Participation history is immutable.');
SELECT set_config('test.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'That participation program is not available to you.');
RESET ROLE;
SELECT set_config('test.actor','',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'Sign in to record participation.');
RESET ROLE;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);

-- Account ownership alone is insufficient after its owner role is removed, or
-- when internal/vendor access would mix with the external-owner capability.
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'That participation program is not available to you.');
RESET ROLE;
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','owner'),('88888888-8888-4888-8888-888888888888','tech');
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'That participation program is not available to you.');
RESET ROLE;
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888' AND role='tech';
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','vendor');
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'That participation program is not available to you.');
RESET ROLE;
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888' AND role='vendor';
-- Opportunity/current enrollment changes are rechecked inside the transaction.
UPDATE owner_reviews SET available_from=now()+interval '1 day' WHERE id='77777777-7777-4777-8777-777777777778';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333']::uuid[])$q$,'Choose an available participation opportunity%');
RESET ROLE;
UPDATE owner_reviews SET available_from=NULL,archived_at=now() WHERE id='77777777-7777-4777-8777-777777777778';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333']::uuid[])$q$,'Choose an available participation opportunity%');
RESET ROLE;
UPDATE owner_reviews SET archived_at=NULL,status='closed' WHERE id='77777777-7777-4777-8777-777777777778';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333']::uuid[])$q$,'Choose an available participation opportunity%');
RESET ROLE;
UPDATE owner_reviews SET status='awaiting_owner' WHERE id='77777777-7777-4777-8777-777777777778';
UPDATE owner_program_properties SET closing_confirmed=false WHERE property_id='33333333-3333-4333-8333-333333333334';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333']::uuid[])$q$,'Participation requires current enrollment%');
RESET ROLE;
UPDATE owner_program_properties SET closing_confirmed=true WHERE property_id='33333333-3333-4333-8333-333333333334';
UPDATE properties SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='33333333-3333-4333-8333-333333333334';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333']::uuid[])$q$,'The opportunity Property is no longer available%');
RESET ROLE;
UPDATE properties SET owner_record_id='11111111-1111-4111-8111-111111111111' WHERE id='33333333-3333-4333-8333-333333333334';
UPDATE owner_program_properties SET archived_at=now() WHERE property_id='33333333-3333-4333-8333-333333333334';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333']::uuid[])$q$,'Participation requires current enrollment%');
RESET ROLE;
SELECT set_config('test.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
UPDATE owner_program_properties SET archived_at=NULL WHERE property_id='33333333-3333-4333-8333-333333333334';
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
-- Returned review opportunities remain valid participation opportunities.
UPDATE owner_reviews SET status='returned' WHERE id='77777777-7777-4777-8777-777777777777';
SET LOCAL ROLE authenticated;
DO $$ DECLARE entry uuid; BEGIN
 entry:=log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=entry AND minutes=15) THEN RAISE EXCEPTION 'returned opportunity lost legitimate participation'; END IF;
END $$;
RESET ROLE;
UPDATE owner_reviews SET status='awaiting_owner' WHERE id='77777777-7777-4777-8777-777777777777';
-- Existing opportunity context cannot bypass the post-closing requirement when
-- program-wide time deliberately records no Property links.
INSERT INTO owner_review_properties(review_id,property_id) VALUES('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333334');
UPDATE owner_program_properties SET closing_date=current_date+1 WHERE program_id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'Participation requires a current post-closing enrollment.');
RESET ROLE;
UPDATE owner_program_properties SET closing_date=current_date-3 WHERE program_id='55555555-5555-4555-8555-555555555555';
DELETE FROM owner_review_properties WHERE review_id='77777777-7777-4777-8777-777777777777';
SELECT expect_time_failure($q$DELETE FROM owner_time_entries WHERE id=boundary_entry()$q$,'Participation evidence is immutable%');

-- Snapshot capture uses the exact reviewed revision, not client-supplied text.
SELECT set_config('test.staff','true',true);
SELECT save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',(SELECT updated_at FROM tickets WHERE id='66666666-6666-4666-8666-666666666666'),0,'11111111-1111-4111-8111-111111111111','Initial owner-safe issue.','Original completed repair summary.','Original reviewed outcome.',true);
SELECT save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',(SELECT updated_at FROM tickets WHERE id='66666666-6666-4666-8666-666666666666'),1,'11111111-1111-4111-8111-111111111111','Later owner-safe issue.','Later completed repair summary.','Later reviewed outcome.',true);
CREATE FUNCTION snapshot_payload() RETURNS jsonb LANGUAGE sql AS $$
 SELECT time_payload((SELECT id FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666'),'66666666-6666-4666-8666-666666666666')
 ||jsonb_build_object('activity','Reviewed the retained Ticket update','ownerUpdateRevision',1,'owner_update_snapshot',jsonb_build_object('issue','FORGED PRIVATE'),'ownerUserId','forged-owner')
$$;
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(snapshot_payload()-'ticketId','{}')$q$,'Time must retain its participation opportunity Ticket link.');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(snapshot_payload(),ARRAY['33333333-3333-4333-8333-333333333334']::uuid[])$q$,'That opportunity belongs to a different Property.');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(snapshot_payload()||'{"ownerUpdateRevision":999}','{}')$q$,'Choose the owner update you reviewed%');
DO $$ DECLARE entry uuid; BEGIN
 entry:=log_owner_time_entry(snapshot_payload(),'{}');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=entry AND owner_user_id=auth.uid() AND ticket_id='66666666-6666-4666-8666-666666666666'
  AND owner_update_revision=1 AND owner_update_snapshot->>'outcome'='Original reviewed outcome.'
  AND owner_update_snapshot::text NOT LIKE '%FORGED%' AND attachment_path='owner/evidence.pdf' AND output='Retained evidence') THEN
  RAISE EXCEPTION 'logging lost canonical Ticket, evidence, actor, or exact revision';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_time_entry_properties WHERE entry_id=entry AND property_id='33333333-3333-4333-8333-333333333333') THEN
  RAISE EXCEPTION 'Ticket time lost canonical Property link';
 END IF;
END $$;
RESET ROLE;
CREATE FUNCTION snapshot_entry() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM owner_time_entries WHERE activity='Reviewed the retained Ticket update' AND amends_entry_id IS NULL $$;

-- Roll back both ordinary logging and review when either required audit writer fails.
CREATE FUNCTION fail_time_boundary_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF coalesce(current_setting('test.fail_time_event',true),'false')='true' AND NEW.kind IN ('time_entry','time_corrected','time_entry_reviewed') THEN
  RAISE EXCEPTION 'forced participation history failure'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER fail_time_boundary_history BEFORE INSERT ON owner_program_events FOR EACH ROW EXECUTE FUNCTION fail_time_boundary_history();
CREATE FUNCTION fail_time_boundary_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF coalesce(current_setting('test.fail_time_audit',true),'false')='true' AND NEW.entity_type='owner_time_entry' THEN
  RAISE EXCEPTION 'forced participation audit failure'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER fail_time_boundary_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_time_boundary_audit();
SELECT set_config('test.fail_time_event','true',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777778'),ARRAY['33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333334']::uuid[])$q$,'forced participation history failure');
RESET ROLE;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT review_owner_time_entry(snapshot_entry(),(SELECT review_version FROM owner_time_entries WHERE id=snapshot_entry()),'returned','Clarify elapsed minutes')$q$,'forced participation history failure');
RESET ROLE;
SELECT set_config('test.fail_time_event','false',true);
SELECT set_config('test.fail_time_audit','true',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE version_before uuid; BEGIN
 SELECT review_version INTO version_before FROM owner_time_entries WHERE id=snapshot_entry();
 PERFORM expect_time_failure($q$SELECT review_owner_time_entry(snapshot_entry(),(SELECT review_version FROM owner_time_entries WHERE id=snapshot_entry()),'returned','Clarify elapsed minutes')$q$,'forced participation audit failure');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=snapshot_entry() AND review_status='submitted' AND review_version=version_before AND reviewed_at IS NULL) THEN
  RAISE EXCEPTION 'audit failure left review metadata/version';
 END IF;
END $$;
RESET ROLE;
SELECT set_config('test.fail_time_audit','false',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT review_owner_time_entry(snapshot_entry(),NULL,'approved','')$q$,'The entry review changed%');
SELECT expect_time_failure($q$SELECT review_owner_time_entry(snapshot_entry(),'00000000-0000-4000-8000-000000000000','approved','')$q$,'The entry review changed%');
SELECT expect_time_failure($q$SELECT review_owner_time_entry(snapshot_entry(),(SELECT review_version FROM owner_time_entries WHERE id=snapshot_entry()),'returned',' ' )$q$,'Choose a review decision%');
DO $$ DECLARE version_before uuid; reviewed uuid; changed integer; BEGIN
 UPDATE owner_time_entries SET review_status='approved' WHERE id=snapshot_entry(); GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'supervisor table write bypassed atomic review'; END IF;
 SELECT review_version INTO version_before FROM owner_time_entries WHERE id=snapshot_entry();
 reviewed:=review_owner_time_entry(snapshot_entry(),version_before,'returned','Clarify elapsed minutes');
 IF reviewed IS DISTINCT FROM snapshot_entry() OR NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=reviewed AND review_status='returned'
  AND reviewed_by=auth.uid() AND reviewed_at IS NOT NULL AND review_version<>version_before AND review_note='Clarify elapsed minutes') THEN
  RAISE EXCEPTION 'atomic staff review missing metadata/version';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE entry_id=reviewed AND kind='time_entry_reviewed' AND detail->>'reviewedVersion'=version_before::text)
  OR NOT EXISTS(SELECT 1 FROM audit_log WHERE entity_id=reviewed AND action='owner_time_entry_returned' AND before_value->>'review_version'=version_before::text) THEN
  RAISE EXCEPTION 'review did not retain exact reviewed version in history/audit';
 END IF;
 PERFORM expect_time_failure(format('SELECT review_owner_time_entry(%L,%L,%L,%L)',reviewed,version_before,'approved',''),'The entry review changed%');
END $$;
RESET ROLE;
-- Role revocation/conflicts apply equally to the historical owner correction action.
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','false',true);
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_entry(),12,'Reviewed the retained Ticket update','Actual minutes')$q$,'That participation program is not available to you.');
RESET ROLE;
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','owner'),('88888888-8888-4888-8888-888888888888','tech');
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_entry(),12,'Reviewed the retained Ticket update','Actual minutes')$q$,'That participation program is not available to you.');
RESET ROLE;
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888' AND role='tech';
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','vendor');
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_entry(),12,'Reviewed the retained Ticket update','Actual minutes')$q$,'That participation program is not available to you.');
RESET ROLE;
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888' AND role='vendor';
-- Returned-entry corrections preserve historical evidence after enrollment,
-- opportunity and Property state changes. They do not claim a new review today.
UPDATE owner_program_properties SET inclusion_status='removed' WHERE program_id='55555555-5555-4555-8555-555555555555';
UPDATE owner_reviews SET status='closed' WHERE ticket_id='66666666-6666-4666-8666-666666666666';
UPDATE properties SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='33333333-3333-4333-8333-333333333333';
UPDATE owner_programs SET status='paused' WHERE id='55555555-5555-4555-8555-555555555555';
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(snapshot_payload(),'{}')$q$,'This program is not open for this participation change.');
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_entry(),0,'Reviewed the retained Ticket update','Correct actual minutes')$q$,'Enter actual minutes%');
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_entry(),12,'Reviewed the retained Ticket update',' ')$q$,'Enter actual minutes%');
RESET ROLE;
SELECT set_config('test.fail_time_event','true',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_entry(),12,'Reviewed the retained Ticket update','Correct actual minutes')$q$,'forced participation history failure');
RESET ROLE;
SELECT set_config('test.fail_time_event','false',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE child uuid; original owner_time_entries; amended owner_time_entries; BEGIN
 SELECT * INTO original FROM owner_time_entries WHERE id=snapshot_entry();
 child:=resubmit_owner_time_entry(original.id,12,'Reviewed the retained Ticket update','Correct actual minutes');
 SELECT * INTO amended FROM owner_time_entries WHERE id=child;
 IF amended.amends_entry_id IS DISTINCT FROM original.id OR amended.minutes<>12 OR amended.review_status<>'submitted'
  OR amended.owner_user_id IS DISTINCT FROM original.owner_user_id OR amended.program_id IS DISTINCT FROM original.program_id
  OR amended.entry_date IS DISTINCT FROM original.entry_date OR amended.ticket_id IS DISTINCT FROM original.ticket_id OR amended.review_id IS DISTINCT FROM original.review_id
  OR amended.attachment_path IS DISTINCT FROM original.attachment_path OR amended.output IS DISTINCT FROM original.output
  OR amended.owner_update_revision IS DISTINCT FROM original.owner_update_revision OR amended.owner_update_snapshot IS DISTINCT FROM original.owner_update_snapshot THEN
  RAISE EXCEPTION 'owner correction lost original context, evidence or reviewed revision';
 END IF;
 IF (SELECT array_agg(property_id ORDER BY property_id) FROM owner_time_entry_properties WHERE entry_id=child)
  IS DISTINCT FROM (SELECT array_agg(property_id ORDER BY property_id) FROM owner_time_entry_properties WHERE entry_id=original.id) THEN
  RAISE EXCEPTION 'owner correction lost removed Property links';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE entry_id=child AND kind='time_entry' AND detail->>'correctionOf'=original.id::text
  AND detail->'propertyIds'=jsonb_build_array('33333333-3333-4333-8333-333333333333')) THEN RAISE EXCEPTION 'owner correction history missing original links'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=original.id AND minutes=15 AND review_status='returned' AND owner_update_snapshot->>'outcome'='Original reviewed outcome.') THEN
  RAISE EXCEPTION 'owner correction rewrote original time or narrative';
 END IF;
 PERFORM expect_time_failure(format('SELECT resubmit_owner_time_entry(%L,11,%L,%L)',original.id,'Duplicate correction','Do not duplicate'),'This entry has already been corrected%');
 PERFORM expect_time_failure(format('SELECT resubmit_owner_time_entry(%L,11,%L,%L)',child,'Unreturned correction','Do not replace submission'),'Only a returned entry can be corrected.');
END $$;
RESET ROLE;
CREATE FUNCTION snapshot_child() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM owner_time_entries WHERE amends_entry_id=snapshot_entry() $$;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT review_owner_time_entry(snapshot_entry(),(SELECT review_version FROM owner_time_entries WHERE id=snapshot_entry()),'approved','')$q$,'This entry was superseded by a correction%');
RESET ROLE;
SELECT expect_time_failure($q$SELECT correct_owner_time_entry(snapshot_child(),'88888888-8888-4888-8888-888888888888',9,'Unauthorized actor')$q$,'Only an authorized supervisor can review or correct participation.');
SELECT expect_time_failure($q$SELECT correct_owner_time_entry(snapshot_entry(),'99999999-9999-4999-8999-999999999999',9,'Duplicate branch')$q$,'This entry has already been corrected.');
SELECT set_config('test.fail_time_event','true',true);
SELECT expect_time_failure($q$SELECT correct_owner_time_entry(snapshot_child(),'99999999-9999-4999-8999-999999999999',9,'Corrected actual minutes')$q$,'forced participation history failure');
SELECT set_config('test.fail_time_event','false',true);
DO $$ DECLARE child uuid; prior owner_time_entries; amended owner_time_entries; multi uuid; multi_child uuid; BEGIN
 SELECT * INTO prior FROM owner_time_entries WHERE id=snapshot_child();
 child:=correct_owner_time_entry(prior.id,'99999999-9999-4999-8999-999999999999',9,'Corrected actual minutes');
 SELECT * INTO amended FROM owner_time_entries WHERE id=child;
 IF amended.amends_entry_id IS DISTINCT FROM prior.id OR amended.minutes<>9 OR amended.review_status<>'submitted'
  OR amended.entry_date IS DISTINCT FROM prior.entry_date OR amended.ticket_id IS DISTINCT FROM prior.ticket_id OR amended.review_id IS DISTINCT FROM prior.review_id
  OR amended.attachment_path IS DISTINCT FROM prior.attachment_path OR amended.output IS DISTINCT FROM prior.output OR amended.comments IS DISTINCT FROM prior.comments
  OR amended.owner_update_revision IS DISTINCT FROM prior.owner_update_revision OR amended.owner_update_snapshot IS DISTINCT FROM prior.owner_update_snapshot THEN
  RAISE EXCEPTION 'staff correction lost original evidence, links or exact revision';
 END IF;
 IF (SELECT array_agg(property_id ORDER BY property_id) FROM owner_time_entry_properties WHERE entry_id=child)
  IS DISTINCT FROM (SELECT array_agg(property_id ORDER BY property_id) FROM owner_time_entry_properties WHERE entry_id=prior.id) THEN
  RAISE EXCEPTION 'staff correction lost removed Property links';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE entry_id=child AND kind='time_corrected' AND actor_id='99999999-9999-4999-8999-999999999999'
  AND previous_value='12' AND new_value='9' AND detail->>'correctionOf'=prior.id::text) THEN RAISE EXCEPTION 'staff correction audit lineage missing'; END IF;
 PERFORM expect_time_failure(format('SELECT correct_owner_time_entry(%L,%L,8,%L)',prior.id,'99999999-9999-4999-8999-999999999999','Duplicate staff correction'),'This entry has already been corrected.');
 IF (SELECT sum(e.minutes) FROM owner_time_entries e WHERE ticket_id='66666666-6666-4666-8666-666666666666'
  AND NOT EXISTS(SELECT 1 FROM owner_time_entries next WHERE next.amends_entry_id=e.id))<>9 THEN RAISE EXCEPTION 'superseded Ticket hours counted twice'; END IF;
 SELECT id INTO multi FROM owner_time_entries WHERE review_id='77777777-7777-4777-8777-777777777778' AND amends_entry_id IS NULL;
 multi_child:=correct_owner_time_entry(multi,'99999999-9999-4999-8999-999999999999',10,'Correct shared elapsed time once');
 IF (SELECT count(*) FROM owner_time_entry_properties WHERE entry_id=multi_child)<>2
  OR (SELECT sum(e.minutes) FROM owner_time_entries e WHERE review_id='77777777-7777-4777-8777-777777777778'
   AND NOT EXISTS(SELECT 1 FROM owner_time_entries next WHERE next.amends_entry_id=e.id))<>10 THEN
  RAISE EXCEPTION 'multi-Property correction lost links or multiplied corrected time';
 END IF;
END $$;
CREATE FUNCTION snapshot_leaf() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM owner_time_entries WHERE amends_entry_id=snapshot_child() $$;
-- A competing external owner cannot correct historical evidence even if it knows the ID.
SELECT set_config('test.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_entry(),12,'Another owner','Attempted correction')$q$,'That entry is not available to you.');
RESET ROLE;

-- Completed/archived programs are immutable report inputs across every time action.
UPDATE owner_programs SET status='completed',completed_at=now() WHERE id='55555555-5555-4555-8555-555555555555';
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'This program is not open for this participation change.');
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_leaf(),8,'Closed program','Attempted correction')$q$,'This program is not open for this participation change.');
RESET ROLE;
SELECT expect_time_failure($q$SELECT correct_owner_time_entry(snapshot_leaf(),'99999999-9999-4999-8999-999999999999',8,'Closed program correction')$q$,'This program is not open for this participation change.');
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT review_owner_time_entry(snapshot_leaf(),(SELECT review_version FROM owner_time_entries WHERE id=snapshot_leaf()),'approved','')$q$,'This program is not open for this participation change.');
RESET ROLE;
UPDATE owner_programs SET status='paused',completed_at=NULL,archived_at=now() WHERE id='55555555-5555-4555-8555-555555555555';
SELECT expect_time_failure($q$SELECT correct_owner_time_entry(snapshot_leaf(),'99999999-9999-4999-8999-999999999999',8,'Archived program correction')$q$,'This program is not open for this participation change.');
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT review_owner_time_entry(snapshot_leaf(),(SELECT review_version FROM owner_time_entries WHERE id=snapshot_leaf()),'approved','')$q$,'This program is not open for this participation change.');
RESET ROLE;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
SELECT expect_time_failure($q$SELECT resubmit_owner_time_entry(snapshot_leaf(),8,'Archived program','Attempted correction')$q$,'This program is not open for this participation change.');
SELECT expect_time_failure($q$SELECT log_owner_time_entry(time_payload('77777777-7777-4777-8777-777777777777'),'{}')$q$,'This program is not open for this participation change.');
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM owner_time_entries WHERE owner_update_snapshot::text LIKE '%FORGED%' OR output LIKE '%PRIVATE%') THEN RAISE EXCEPTION 'private or forged narrative leaked into participation'; END IF;
 IF (SELECT count(*) FROM owner_time_entries WHERE ticket_id='66666666-6666-4666-8666-666666666666' AND owner_update_snapshot->>'outcome'='Original reviewed outcome.')<>3 THEN
  RAISE EXCEPTION 'immutable reviewed snapshot was lost across historical corrections';
 END IF;
END $$;
ROLLBACK;
