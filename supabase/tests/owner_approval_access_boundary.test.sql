BEGIN;
CREATE FUNCTION pg_temp.approval_assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.approval_denied(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%'||expected||'%' THEN RETURN; ELSE RAISE; END IF; END; RAISE EXCEPTION 'Expected denial: %',statement; END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-4000-9000-000000000001','owner@example.test',now()),('00000000-0000-4000-9000-000000000002','other@example.test',now()),
 ('00000000-0000-4000-9000-000000000003','admin@example.test',now()),('00000000-0000-4000-9000-000000000004','vendor@example.test',now());
INSERT INTO user_roles(user_id,role) VALUES('00000000-0000-4000-9000-000000000001','owner'),('00000000-0000-4000-9000-000000000002','owner'),
 ('00000000-0000-4000-9000-000000000003','admin'),('00000000-0000-4000-9000-000000000004','vendor');
INSERT INTO property_owners(id,name,active) VALUES('00000000-0000-4000-9000-000000000011','Owner A',true),('00000000-0000-4000-9000-000000000012','Owner B',true);
INSERT INTO properties(id,name,owner_record_id,is_demo) VALUES('00000000-0000-4000-9000-000000000021','Home A','00000000-0000-4000-9000-000000000011',false),
 ('00000000-0000-4000-9000-000000000022','Home B','00000000-0000-4000-9000-000000000012',false);
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES
 ('00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','00000000-0000-4000-9000-000000000011','00000000-0000-4000-9000-000000000001','draft',false),
 ('00000000-0000-4000-9000-000000000032','00000000-0000-4000-9000-000000000022','00000000-0000-4000-9000-000000000012','00000000-0000-4000-9000-000000000002','draft',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed) VALUES
 ('00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','included',current_date,true),
 ('00000000-0000-4000-9000-000000000032','00000000-0000-4000-9000-000000000022','included',current_date,true);
UPDATE owner_programs SET status='active',started_on=current_date,ends_on=current_date+89;
INSERT INTO approvals(id,entity_type,entity_id,property_id,kind,title,detail,amount,currency,approver_id,approver_role,status,is_demo,evidence_url,requested_by) VALUES
 ('00000000-0000-4000-9000-000000000091','property','00000000-0000-4000-9000-000000000021','00000000-0000-4000-9000-000000000021','SECRET KIND','SECRET guest title','SECRET credentials',50,'USD','00000000-0000-4000-9000-000000000001','owner','pending',false,'https://private.invalid/SECRET','00000000-0000-4000-9000-000000000003'),
 ('00000000-0000-4000-9000-000000000092','property','00000000-0000-4000-9000-000000000022','00000000-0000-4000-9000-000000000022','other','Other private title','Other private detail',40,'USD','00000000-0000-4000-9000-000000000002','owner','pending',false,NULL,'00000000-0000-4000-9000-000000000003');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM approvals)=0,'Raw owner approval SELECT survived');
WITH changed AS(UPDATE approvals SET amount=0,status='approved',detail='changed' WHERE id='00000000-0000-4000-9000-000000000091' RETURNING id)
SELECT pg_temp.approval_assert((SELECT count(*) FROM changed)=0,'Raw owner approval UPDATE survived');
SELECT pg_temp.approval_assert((SELECT count(*) FROM read_owner_approvals())=1,'Owner projection recipient scope is incorrect');
SELECT pg_temp.approval_assert((SELECT approval::text NOT LIKE '%SECRET%' AND approval->>'can_respond'='false' AND approval->>'blocked_reason' LIKE '%review and publish%' FROM read_owner_approvals()),'Unreviewed approval context exposed or actionable');
SELECT pg_temp.approval_denied($q$SELECT read_owner_approval_publication_context('00000000-0000-4000-9000-000000000091')$q$,'Only staff');
SELECT pg_temp.approval_denied($q$SELECT private.work_order_owner_recipient('00000000-0000-4000-9000-000000000051')$q$,'enabled staff');
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval('00000000-0000-4000-9000-000000000091',NULL,now(),true,'')$q$,'staff-reviewed summary');
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval('00000000-0000-4000-9000-000000000092',NULL,now(),true,'')$q$,'not available');
RESET ROLE;
-- Publication uses captured canonical identity and revision, no inferred recipient.
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
CREATE FUNCTION pg_temp.publish_test(_revision integer DEFAULT 0,_title text DEFAULT 'Owner-safe decision') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE version timestamptz; BEGIN SELECT updated_at INTO version FROM approvals WHERE id='00000000-0000-4000-9000-000000000091';
 RETURN publish_owner_approval('00000000-0000-4000-9000-000000000091',version,_revision,'00000000-0000-4000-9000-000000000011',
 '00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000001',_title,'Please approve the proposed owner-safe property improvement.',true); END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.publish_test();
SELECT pg_temp.approval_denied($q$SELECT pg_temp.publish_test()$q$,'published context changed');
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT count(*) FROM owner_approval_publications)=1,'Publication retry created duplicate');
SELECT pg_temp.approval_denied($q$UPDATE owner_approval_publications SET detail='overwrite'$q$,'immutable');
SELECT pg_temp.approval_denied($q$DELETE FROM owner_approval_publications$q$,'immutable');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM owner_approval_publications)=0,'Raw publication metadata exposed');
SELECT pg_temp.approval_assert((SELECT approval->>'title'='Owner-safe decision' AND approval->>'can_respond'='true' AND approval::text NOT LIKE '%SECRET%' FROM read_owner_approvals()),'Reviewed projection is unavailable or unsafe');
RESET ROLE;
-- Retain the exact displayed publication, including when only the narrative changes.
CREATE TEMP TABLE captured AS SELECT id,updated_at,(SELECT id FROM owner_approval_publications WHERE approval_id=a.id) AS publication_id FROM approvals a WHERE id='00000000-0000-4000-9000-000000000091';
GRANT SELECT ON captured TO authenticated;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
SELECT pg_temp.publish_test(1,'Revised owner-safe decision');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,publication_id,updated_at,true,'') FROM captured$q$,'staff-reviewed summary');
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,NULL,true,'') FROM read_owner_approvals()$q$,'staff-reviewed summary');
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,false,'') FROM read_owner_approvals()$q$,'provide a valid decision');
RESET ROLE;
-- Role removal, mixed roles, disabled account, demo and canonical transfer revoke current access.
DELETE FROM user_roles WHERE user_id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM read_owner_approvals())=0,'Removed owner role still reads approvals');
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,publication_id,updated_at,true,'') FROM captured$q$,'not available');
RESET ROLE;
INSERT INTO user_roles(user_id,role) VALUES('00000000-0000-4000-9000-000000000001','owner'),('00000000-0000-4000-9000-000000000001','vendor');
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM read_owner_approvals())=0,'Mixed owner/vendor role still reads approvals');
RESET ROLE;
DELETE FROM user_roles WHERE user_id='00000000-0000-4000-9000-000000000001' AND role='vendor';
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM read_owner_approvals())=0,'Disabled account still reads approvals');
RESET ROLE;
UPDATE auth.users SET banned_until=NULL WHERE id='00000000-0000-4000-9000-000000000001';
UPDATE approvals SET is_demo=true WHERE id='00000000-0000-4000-9000-000000000091';
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM read_owner_approvals())=0,'Demo approval leaked');
RESET ROLE;
UPDATE approvals SET is_demo=false WHERE id='00000000-0000-4000-9000-000000000091';
UPDATE properties SET owner_record_id='00000000-0000-4000-9000-000000000012' WHERE id='00000000-0000-4000-9000-000000000021';
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM read_owner_approvals())=0,'Transferred Property leaked');
RESET ROLE;
UPDATE properties SET owner_record_id='00000000-0000-4000-9000-000000000011' WHERE id='00000000-0000-4000-9000-000000000021';
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
SELECT pg_temp.publish_test(2,'Final owner-safe decision');
-- Failure in audit rolls back canonical decision AND receipt.
CREATE FUNCTION pg_temp.fail_approval_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced approval audit failure'; END $$;
CREATE TRIGGER fail_approval_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_approval_audit();
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,true,'Agreed') FROM read_owner_approvals()$q$,'forced approval audit failure');
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT status='pending' FROM approvals WHERE id='00000000-0000-4000-9000-000000000091') AND NOT EXISTS(SELECT 1 FROM owner_approval_receipts),'Partial response survived audit failure');
DROP TRIGGER fail_approval_audit ON audit_log;
SET LOCAL ROLE authenticated;
SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,true,'Agreed') FROM read_owner_approvals();
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,true,'Again') FROM read_owner_approvals()$q$,'already recorded');
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT count(*) FROM owner_approval_receipts)=1,'Missing or duplicate decision receipt');
SELECT pg_temp.approval_denied($q$DELETE FROM owner_approval_receipts$q$,'immutable');
UPDATE approvals SET title='SECRET later title',detail='SECRET later note',decision_note='SECRET later internal note',amount=999 WHERE id='00000000-0000-4000-9000-000000000091';
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
UPDATE owner_program_properties SET inclusion_status='removed' WHERE program_id='00000000-0000-4000-9000-000000000031';
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT approval->>'title'='Final owner-safe decision' AND approval->>'amount'='50' AND approval->>'decision_note'='Agreed' AND approval->>'revision'='3' AND approval::text NOT LIKE '%SECRET%' FROM read_owner_approvals()),'History changed or disappeared after Property removal');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT count(*) FROM read_owner_approvals() WHERE id='00000000-0000-4000-9000-000000000091')=0,'Another owner read historical receipt');
RESET ROLE;
-- Internal assigned/supervisor mutation still works; owner publication does not change that authority.
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
SET LOCAL ROLE authenticated;
WITH changed AS(UPDATE approvals SET due_on=current_date+1 WHERE id='00000000-0000-4000-9000-000000000092' RETURNING id)
SELECT pg_temp.approval_assert((SELECT count(*) FROM changed)=1,'Legitimate staff approval mutation blocked');
RESET ROLE;
-- Explicit Work Order summary publishes and responds through the existing canonical mirrors atomically.
UPDATE owner_program_properties SET inclusion_status='included' WHERE program_id='00000000-0000-4000-9000-000000000031';
INSERT INTO work_orders(id,property_id,title,scope,quote_amount) VALUES('00000000-0000-4000-9000-000000000051','00000000-0000-4000-9000-000000000021','SECRET repair title','SECRET access',650);
SET LOCAL ROLE authenticated;
SELECT prepare_work_order_owner_approval('00000000-0000-4000-9000-000000000051','2026-09-15T00:00:00Z','Please approve replacement of the leaking water heater.');
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT count(*) FROM owner_approval_publications WHERE entity_type='work_order')=1,'Explicit Work Order summary did not publish atomically');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,true,'Approve replacement') FROM read_owner_approvals() WHERE approval->>'status'='pending';
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT approval_status='approved' AND approved_amount=650 FROM work_orders WHERE id='00000000-0000-4000-9000-000000000051'),'Canonical Work Order response delegate lost');
SELECT pg_temp.approval_assert((SELECT count(*) FROM owner_approval_receipts)=2,'Work Order exact publication receipt missing');
-- Onboarding task and finance delegates retain their mirrors and reject source-cost races.
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
INSERT INTO onboarding_tasks(id,property_id,title,status,owner_approval_status,is_demo)
 VALUES('00000000-0000-4000-9000-000000000061','00000000-0000-4000-9000-000000000021','SECRET task title','in_progress','awaiting_owner',false);
INSERT INTO financial_requests(id,property_id,title,status,estimate_amount,authority_tier,kind,is_demo,approval_id)
 VALUES('00000000-0000-4000-9000-000000000071','00000000-0000-4000-9000-000000000021','SECRET financial title','awaiting_approval',550,'owner','repair',false,'00000000-0000-4000-9000-000000000094');
INSERT INTO approvals(id,entity_type,entity_id,property_id,kind,title,detail,amount,currency,approver_id,approver_role,status,is_demo,requested_by) VALUES
 ('00000000-0000-4000-9000-000000000093','onboarding_task','00000000-0000-4000-9000-000000000061','00000000-0000-4000-9000-000000000021','onboarding_task','SECRET task','SECRET detail',NULL,'USD','00000000-0000-4000-9000-000000000001','owner','pending',false,'00000000-0000-4000-9000-000000000003'),
 ('00000000-0000-4000-9000-000000000094','financial_request','00000000-0000-4000-9000-000000000071','00000000-0000-4000-9000-000000000021','onboarding_repair','SECRET financial','SECRET vendor invoice',550,'USD','00000000-0000-4000-9000-000000000001','owner','pending',false,'00000000-0000-4000-9000-000000000003');
SET LOCAL ROLE authenticated;
SELECT publish_owner_approval(id,updated_at,0,'00000000-0000-4000-9000-000000000011','00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000001',
 'Reviewed onboarding request','Please review and decide the proposed property preparation.',true) FROM approvals WHERE id IN('00000000-0000-4000-9000-000000000093','00000000-0000-4000-9000-000000000094');
RESET ROLE;
UPDATE financial_requests SET estimate_amount=600 WHERE id='00000000-0000-4000-9000-000000000071';
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT approval->>'can_respond'='false' FROM read_owner_approvals() WHERE id='00000000-0000-4000-9000-000000000094'),'Changed source cost still actionable');
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,true,'Approve') FROM read_owner_approvals() WHERE id='00000000-0000-4000-9000-000000000094'$q$,'source, amount');
RESET ROLE;
UPDATE financial_requests SET estimate_amount=550 WHERE id='00000000-0000-4000-9000-000000000071';
CREATE FUNCTION pg_temp.fail_approval_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced receipt failure'; END $$;
CREATE TRIGGER fail_approval_receipt BEFORE INSERT ON owner_approval_receipts FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_approval_receipt();
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_denied($q$SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,true,'Approve') FROM read_owner_approvals() WHERE id='00000000-0000-4000-9000-000000000094'$q$,'forced receipt failure');
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT status='pending' FROM approvals WHERE id='00000000-0000-4000-9000-000000000094') AND (SELECT approved_amount IS NULL AND status='awaiting_approval' FROM financial_requests WHERE id='00000000-0000-4000-9000-000000000071'),'Receipt failure left partial financial response');
DROP TRIGGER fail_approval_receipt ON owner_approval_receipts;
SET LOCAL ROLE authenticated;
SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,false,'Please revise the proposed finish') FROM read_owner_approvals() WHERE id='00000000-0000-4000-9000-000000000093';
SELECT respond_owner_approval(id,(approval->>'publication_id')::uuid,(approval->>'updated_at')::timestamptz,true,'Approve this quote') FROM read_owner_approvals() WHERE id='00000000-0000-4000-9000-000000000094';
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT owner_approval_status='changes_requested' FROM onboarding_tasks WHERE id='00000000-0000-4000-9000-000000000061'),'Task decision mirror lost');
SELECT pg_temp.approval_assert((SELECT status='approved' AND approved_amount=550 FROM financial_requests WHERE id='00000000-0000-4000-9000-000000000071'),'Financial decision mirror lost');
SELECT pg_temp.approval_assert((SELECT count(*) FROM owner_approval_receipts)=4,'Delegated responses lost immutable receipt');
-- Staff transcription retains the same reviewed narrative, but not private email notes.
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
INSERT INTO work_orders(id,property_id,title,scope,quote_amount) VALUES('00000000-0000-4000-9000-000000000052','00000000-0000-4000-9000-000000000021','SECRET second repair','SECRET access',300);
SET LOCAL ROLE authenticated;
SELECT prepare_work_order_owner_approval('00000000-0000-4000-9000-000000000052','2026-09-15T00:00:00Z','Please approve the proposed second repair at this Property.');
SELECT record_staff_work_order_owner_decision('00000000-0000-4000-9000-000000000052','2026-09-15T00:00:00Z','approved',250,'SECRET staff-only email and access context');
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT r.actor_id='00000000-0000-4000-9000-000000000003' AND r.decision_note IS NULL FROM owner_approval_receipts r JOIN owner_approval_publications p ON p.id=r.publication_id WHERE p.entity_id='00000000-0000-4000-9000-000000000052'),'Staff receipt lost actor or exposed private note');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_assert((SELECT approval->>'detail'='Please approve the proposed second repair at this Property.' AND approval->>'recorded_by_owner'='false' AND approval::text NOT LIKE '%SECRET%' FROM read_owner_approvals() WHERE id=(SELECT (approval->>'id')::uuid FROM read_owner_approvals() WHERE approval->>'detail'='Please approve the proposed second repair at this Property.')),'Staff transcription lost safe reviewed context');
RESET ROLE;
-- Publishing and automatic Work Order preparation roll back on audit failure.
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
INSERT INTO work_orders(id,property_id,title,quote_amount) VALUES('00000000-0000-4000-9000-000000000053','00000000-0000-4000-9000-000000000021','Repair',200);
CREATE TRIGGER fail_approval_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_approval_audit();
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_denied($q$SELECT prepare_work_order_owner_approval('00000000-0000-4000-9000-000000000053','2026-09-15T00:00:00Z','Please approve this proposed repair with its clear quote.')$q$,'forced approval audit failure');
RESET ROLE;
SELECT pg_temp.approval_assert((SELECT approval_id IS NULL FROM work_orders WHERE id='00000000-0000-4000-9000-000000000053') AND NOT EXISTS(SELECT 1 FROM approvals WHERE entity_id='00000000-0000-4000-9000-000000000053') AND NOT EXISTS(SELECT 1 FROM owner_approval_publications WHERE entity_id='00000000-0000-4000-9000-000000000053'),'Failed publication left partial Work Order request');
DROP TRIGGER fail_approval_audit ON audit_log;
-- Reaching the hour target must not lose the canonical pending approval recipient.
UPDATE owner_programs SET status='target_reached' WHERE id='00000000-0000-4000-9000-000000000031';
INSERT INTO work_orders(id,property_id,title,quote_amount) VALUES
 ('00000000-0000-4000-9000-000000000054','00000000-0000-4000-9000-000000000021','Target reached repair',450),
 ('00000000-0000-4000-9000-000000000055','00000000-0000-4000-9000-000000000021','Removed Property request',450),
 ('00000000-0000-4000-9000-000000000056','00000000-0000-4000-9000-000000000021','Disabled account request',450);
SET LOCAL ROLE authenticated;
SELECT prepare_work_order_owner_approval('00000000-0000-4000-9000-000000000054','2026-09-15T00:00:00Z','Please approve the quoted repair after reviewing the planned work.');
RESET ROLE;
SELECT pg_temp.approval_assert(EXISTS(SELECT 1 FROM approvals WHERE entity_id='00000000-0000-4000-9000-000000000054' AND approver_id='00000000-0000-4000-9000-000000000001') AND EXISTS(SELECT 1 FROM owner_approval_publications WHERE entity_id='00000000-0000-4000-9000-000000000054'),'Target-reached program lost eligible canonical recipient/publication');
UPDATE owner_program_properties SET inclusion_status='removed' WHERE program_id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT prepare_work_order_owner_approval('00000000-0000-4000-9000-000000000055','2026-09-15T00:00:00Z','Review the proposed repair before staff reconcile its current recipient.');
RESET ROLE;
SELECT pg_temp.approval_assert(EXISTS(SELECT 1 FROM approvals WHERE entity_id='00000000-0000-4000-9000-000000000055' AND approver_id IS NULL) AND NOT EXISTS(SELECT 1 FROM owner_approval_publications WHERE entity_id='00000000-0000-4000-9000-000000000055'),'Removed Property still received an owner-facing request');
UPDATE owner_program_properties SET inclusion_status='included' WHERE program_id='00000000-0000-4000-9000-000000000031';
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT prepare_work_order_owner_approval('00000000-0000-4000-9000-000000000056','2026-09-15T00:00:00Z','Review the proposed repair before staff reconcile its enabled recipient.');
RESET ROLE;
SELECT pg_temp.approval_assert(EXISTS(SELECT 1 FROM approvals WHERE entity_id='00000000-0000-4000-9000-000000000056' AND approver_id IS NULL) AND NOT EXISTS(SELECT 1 FROM owner_approval_publications WHERE entity_id='00000000-0000-4000-9000-000000000056'),'Disabled account received an owner-facing request');
UPDATE auth.users SET banned_until=NULL WHERE id='00000000-0000-4000-9000-000000000001';
-- Ambiguous retained canonical enrollment never chooses an arbitrary recipient.
SAVEPOINT ambiguous_recipient;
UPDATE owner_programs SET status='completed' WHERE id='00000000-0000-4000-9000-000000000031';
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo)
 VALUES('00000000-0000-4000-9000-000000000033','00000000-0000-4000-9000-000000000021','00000000-0000-4000-9000-000000000011','00000000-0000-4000-9000-000000000001','draft',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed)
 VALUES('00000000-0000-4000-9000-000000000033','00000000-0000-4000-9000-000000000021','included',current_date,true);
UPDATE owner_programs SET status='completed' WHERE id='00000000-0000-4000-9000-000000000033';
UPDATE owner_programs SET status='target_reached' WHERE id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT pg_temp.approval_denied($q$SELECT private.work_order_owner_recipient('00000000-0000-4000-9000-000000000054')$q$,'more than one eligible');
RESET ROLE;
ROLLBACK TO SAVEPOINT ambiguous_recipient;
-- A direct service-table insert cannot forge privacy review or retained history.
SET LOCAL ROLE service_role;
SELECT pg_temp.approval_denied($q$INSERT INTO owner_approval_publications(approval_id,revision,approval_updated_at,program_id,owner_record_id,property_id,recipient_id,entity_type,entity_id,title,detail,amount,currency,reviewed_by)
 SELECT approval_id,999,approval_updated_at,program_id,owner_record_id,property_id,recipient_id,entity_type,entity_id,'Forged owner title','Forged unchecked private staff information',amount,currency,reviewed_by FROM owner_approval_publications LIMIT 1$q$,'checked atomic action');
SELECT pg_temp.approval_denied($q$INSERT INTO owner_approval_receipts(approval_id,publication_id,status,decision_note,decided_at,actor_id)
 SELECT approval_id,publication_id,status,'Forged owner decision',decided_at,actor_id FROM owner_approval_receipts LIMIT 1$q$,'checked atomic action');
RESET ROLE;
ROLLBACK;
