BEGIN;
CREATE FUNCTION pg_temp.life_assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.life_denied(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%'||expected||'%' THEN RETURN; ELSE RAISE; END IF; END; RAISE EXCEPTION 'Expected denial: %',statement; END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('00000000-0000-4000-9000-000000000001','owner@example.test',now()),
 ('00000000-0000-4000-9000-000000000002','other@example.test',now()),('00000000-0000-4000-9000-000000000003','admin@example.test',now()),
 ('00000000-0000-4000-9000-000000000004','manager@example.test',now());
-- The role serialization trigger permits legitimate signup/admin role writes.
INSERT INTO user_roles(user_id,role) VALUES('00000000-0000-4000-9000-000000000001','owner'),('00000000-0000-4000-9000-000000000002','owner'),
 ('00000000-0000-4000-9000-000000000003','admin'),('00000000-0000-4000-9000-000000000004','manager');
INSERT INTO property_owners(id,name,email,active) VALUES('00000000-0000-4000-9000-000000000011','Canonical Owner A','owner-a@example.test',true),('00000000-0000-4000-9000-000000000012','Canonical Owner B','owner-b@example.test',true);
INSERT INTO properties(id,name,owner_record_id,is_demo,actual_closing_on) VALUES
 ('00000000-0000-4000-9000-000000000021','Home A','00000000-0000-4000-9000-000000000011',false,current_date-5),
 ('00000000-0000-4000-9000-000000000022','Second A','00000000-0000-4000-9000-000000000011',false,current_date-5),
 ('00000000-0000-4000-9000-000000000023','Home B','00000000-0000-4000-9000-000000000012',false,current_date-5),
 ('00000000-0000-4000-9000-000000000024','Demo A','00000000-0000-4000-9000-000000000011',true,current_date-5),
 ('00000000-0000-4000-9000-000000000025','Late A','00000000-0000-4000-9000-000000000011',false,current_date-1);
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT create_owner_program('00000000-0000-4000-9000-000000000021')$q$,'do not have access');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT create_owner_program('00000000-0000-4000-9000-000000000021');
SELECT pg_temp.life_assert((create_owner_program('00000000-0000-4000-9000-000000000021')->>'alreadyExists')::boolean,'Idempotent creation failed');
RESET ROLE;
SELECT pg_temp.life_assert((SELECT count(*) FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011')=1 AND (SELECT count(*) FROM owner_program_properties)=1 AND (SELECT count(*) FROM owner_program_events WHERE kind='program_created')=1,'Creation split canonical state/history: '||(SELECT count(*) FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011')||' programs / '||(SELECT count(*) FROM owner_program_properties)||' enrollments / '||(SELECT count(*) FROM owner_program_events WHERE kind='program_created')||' events');
SELECT pg_temp.life_assert((SELECT owner_record_id='00000000-0000-4000-9000-000000000011' AND owner_name='Canonical Owner A' AND owner_email='owner-a@example.test' AND status='draft' AND started_on IS NULL AND ends_on IS NULL FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011'),'Creation used noncanonical identity or started clock');
CREATE TEMP TABLE life_context AS SELECT id,report_version FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011';
GRANT SELECT ON life_context TO authenticated,service_role;
CREATE FUNCTION pg_temp.life_change(_action text,_property uuid DEFAULT NULL,_closing date DEFAULT NULL,_settings jsonb DEFAULT NULL,_status text DEFAULT NULL,_reason text DEFAULT NULL,_phase text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p owner_programs; BEGIN SELECT * INTO p FROM owner_programs WHERE id=(SELECT id FROM life_context); RETURN change_owner_program(p.id,p.report_version,_action,_property,_closing,_settings,_status,_reason,_phase); END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$UPDATE owner_programs SET status='waiting_for_closing'$q$,'checked atomic');
SELECT pg_temp.life_denied($q$UPDATE owner_program_properties SET closing_confirmed=true$q$,'checked atomic');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('add_property','00000000-0000-4000-9000-000000000023')$q$,'same current canonical Owner');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('add_property','00000000-0000-4000-9000-000000000024')$q$,'same current canonical Owner');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('remove_property','00000000-0000-4000-9000-000000000021',NULL,NULL,NULL,'Reason')$q$,'at least one');
SELECT pg_temp.life_change('add_property','00000000-0000-4000-9000-000000000022',current_date-5);
SELECT pg_temp.life_denied($q$SELECT change_owner_program(id,report_version,'status',NULL,NULL,NULL,'waiting_for_closing') FROM life_context$q$,'program changed');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('confirm_closing','00000000-0000-4000-9000-000000000021',current_date+1)$q$,'no later than');
SELECT pg_temp.life_change('confirm_closing','00000000-0000-4000-9000-000000000021',current_date-5);
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('settings',NULL,NULL,'{"dfyConfirmed":true,"ownerName":"Free-text replacement"}')$q$,'canonical Owner record');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('settings',NULL,NULL,'{"dfyConfirmed":true,"onboardingLead":"A staff name"}')$q$,'current staff account list');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('settings',NULL,NULL,'{"dfyConfirmed":true,"onboardingLead":"00000000-0000-4000-9000-000000000001"}')$q$,'current enabled staff');
SELECT pg_temp.life_change('settings',NULL,NULL,'{"dfyConfirmed":true,"onboardingLead":"00000000-0000-4000-9000-000000000004","operationsLead":null,"internalNotes":"Private staff setup note"}');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('status',NULL,NULL,NULL,'active')$q$,'activation or completion');
SELECT activate_owner_program(id,report_version,current_date-3) FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011';
SELECT pg_temp.life_change('status',NULL,NULL,NULL,'paused');
SELECT pg_temp.life_change('status',NULL,NULL,NULL,'active');
RESET ROLE;
SELECT pg_temp.life_assert((SELECT status='active' AND started_on=current_date-3 AND ends_on=current_date+86 AND onboarding_lead='00000000-0000-4000-9000-000000000004' FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011'),'Lifecycle reset clock or lost canonical lead');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('add_property','00000000-0000-4000-9000-000000000025',current_date-1)$q$,'requires an administrator');
SELECT pg_temp.life_denied($q$SELECT create_owner_program('00000000-0000-4000-9000-000000000024')$q$,'administrator');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_change('add_property','00000000-0000-4000-9000-000000000025',current_date-1);
SELECT pg_temp.life_change('remove_property','00000000-0000-4000-9000-000000000025',NULL,NULL,NULL,'Preserve history after removal');
RESET ROLE;
SELECT pg_temp.life_assert((SELECT inclusion_status='removed' FROM owner_program_properties WHERE property_id='00000000-0000-4000-9000-000000000025') AND EXISTS(SELECT 1 FROM owner_program_events WHERE property_id='00000000-0000-4000-9000-000000000025' AND kind='property_removed'),'Removal lost history');
-- A failing history write rolls back both a new program and its enrollment.
CREATE FUNCTION pg_temp.life_fail_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced lifecycle history failure'; END $$;
CREATE TRIGGER life_fail_history BEFORE INSERT ON owner_program_events FOR EACH ROW EXECUTE FUNCTION pg_temp.life_fail_history();
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT create_owner_program('00000000-0000-4000-9000-000000000023')$q$,'forced lifecycle history failure');
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('status',NULL,NULL,NULL,'paused')$q$,'forced lifecycle history failure');
RESET ROLE;
SELECT pg_temp.life_assert(NOT EXISTS(SELECT 1 FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000012') AND NOT EXISTS(SELECT 1 FROM owner_program_properties WHERE property_id='00000000-0000-4000-9000-000000000023') AND (SELECT status='active' FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011'),'History failure left partial lifecycle state');
DROP TRIGGER life_fail_history ON owner_program_events;
INSERT INTO owner_task_templates(id,phase,stage,title,summary,owner_action,decision_path,owner_action_type,active) VALUES
 ('00000000-0000-4000-9000-000000000081','onboarding','Prepare','Review preparation','Review the property preparation','Record your review','consult','review_comment',true),
 ('00000000-0000-4000-9000-000000000082','ongoing','Recurring','Review monthly work','Review the program operations','Review the work','inform','information_only',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_assert((pg_temp.life_change('seed_roadmap',NULL,NULL,NULL,NULL,NULL,'all')->>'added')::integer=3,'Roadmap did not seed once per canonical target');
SELECT pg_temp.life_assert((pg_temp.life_change('seed_roadmap',NULL,NULL,NULL,NULL,NULL,'all')->>'added')::integer=0,'Roadmap retry duplicated opportunities');
RESET ROLE;
SELECT pg_temp.life_assert((SELECT count(*) FROM owner_review_properties)=2 AND (SELECT count(*) FROM owner_program_events WHERE kind='roadmap_seeded')=1,'Roadmap links/history incomplete');
INSERT INTO onboarding_tasks(id,property_id,title,detail,stage,status,is_demo) VALUES('00000000-0000-4000-9000-000000000061','00000000-0000-4000-9000-000000000021','SECRET task title','SECRET source note','Prepare','in_progress',false);
CREATE FUNCTION pg_temp.life_offer(_reviewed boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE p owner_programs; source_version timestamptz; BEGIN
 SELECT * INTO p FROM owner_programs WHERE id=(SELECT id FROM life_context);
 SELECT updated_at INTO source_version FROM onboarding_tasks WHERE id='00000000-0000-4000-9000-000000000061';
 RETURN create_owner_opportunity(p.id,p.report_version,p.owner_record_id,'onboarding','00000000-0000-4000-9000-000000000061',source_version,
 'Owner-safe preparation review','Please review the proposed property setup so your preferences can guide preparation.','review_comment',NULL,NULL,'SECRET staff context',_reviewed); END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_offer(false)$q$,'Review the owner-facing');
RESET ROLE;
CREATE FUNCTION pg_temp.life_fail_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced opportunity link failure'; END $$;
CREATE TRIGGER life_fail_link BEFORE INSERT ON owner_review_properties FOR EACH ROW EXECUTE FUNCTION pg_temp.life_fail_link();
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_offer()$q$,'forced opportunity link failure');
RESET ROLE;
SELECT pg_temp.life_assert(NOT EXISTS(SELECT 1 FROM owner_reviews WHERE onboarding_task_id='00000000-0000-4000-9000-000000000061') AND NOT EXISTS(SELECT 1 FROM owner_program_events WHERE kind='opportunity_created'),'Manual opportunity partially persisted after link failure');
DROP TRIGGER life_fail_link ON owner_review_properties;
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_offer();
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_offer()$q$,'already been offered');
SELECT pg_temp.life_denied($q$UPDATE owner_reviews SET recommendation='private replacement' WHERE onboarding_task_id='00000000-0000-4000-9000-000000000061'$q$,'immutable');
RESET ROLE;
SELECT pg_temp.life_assert((SELECT count(*) FROM owner_reviews WHERE onboarding_task_id='00000000-0000-4000-9000-000000000061')=1 AND (SELECT count(*) FROM owner_program_events WHERE kind='opportunity_created')=1,'Manual opportunity duplicate/history failure');
SELECT pg_temp.life_denied($q$UPDATE owner_program_events SET summary='rewritten'$q$,'immutable');
SELECT pg_temp.life_denied($q$UPDATE owner_programs SET owner_record_id='00000000-0000-4000-9000-000000000012'$q$,'canonical Owner');
-- Even trusted maintenance cannot silently rewrite a published manual narrative.
SELECT pg_temp.life_denied($q$UPDATE owner_reviews SET business_question='new private question',owner_action_type='approve_only' WHERE onboarding_task_id='00000000-0000-4000-9000-000000000061'$q$,'immutable');
INSERT INTO owner_invites(program_id,code,owner_email,expires_at) SELECT id,'LIFECYCLE-CODE','owner@example.test',now()+interval '1 day' FROM life_context;
SET LOCAL ROLE service_role;
SELECT pg_temp.life_denied($q$UPDATE owner_programs SET owner_user_id='00000000-0000-4000-9000-000000000002' WHERE id=(SELECT id FROM life_context)$q$,'atomic invitation');
SELECT redeem_owner_invite('00000000-0000-4000-9000-000000000001','LIFECYCLE-CODE');
SELECT redeem_owner_invite('00000000-0000-4000-9000-000000000001','LIFECYCLE-CODE');
SELECT pg_temp.life_denied($q$UPDATE owner_programs SET owner_user_id='00000000-0000-4000-9000-000000000002' WHERE id=(SELECT id FROM life_context)$q$,'atomic invitation');
RESET ROLE;
SELECT pg_temp.life_assert((SELECT owner_user_id='00000000-0000-4000-9000-000000000001' FROM owner_programs WHERE id=(SELECT id FROM life_context)) AND (SELECT count(*) FROM owner_program_events WHERE kind='owner_linked')=1 AND (SELECT count(*) FROM owner_invite_redemptions)=1,'Checked redemption or its idempotent history broke under lifecycle guards');
-- Canonical owner responses still use the checked definer after table writes close.
CREATE TEMP TABLE life_review AS SELECT id,updated_at FROM owner_reviews WHERE onboarding_task_id='00000000-0000-4000-9000-000000000061';
GRANT SELECT ON life_review TO authenticated,service_role;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT respond_owner_review(id,updated_at,'reviewed','I reviewed the property setup.',NULL) FROM life_review;
RESET ROLE;
SELECT pg_temp.life_assert(EXISTS(SELECT 1 FROM owner_reviews WHERE id=(SELECT id FROM life_review) AND status='answered') AND EXISTS(SELECT 1 FROM owner_program_events WHERE review_id=(SELECT id FROM life_review) AND kind='owner_decision'),'Checked response or immutable history broke under lifecycle guard');
SELECT pg_temp.life_denied($q$UPDATE owner_reviews SET property_id='00000000-0000-4000-9000-000000000022' WHERE id=(SELECT id FROM life_review)$q$,'immutable');
SELECT pg_temp.life_denied($q$UPDATE owner_reviews SET auto_ticket=true WHERE id=(SELECT id FROM life_review)$q$,'revision model');
SELECT pg_temp.life_denied($q$DELETE FROM owner_review_properties WHERE review_id=(SELECT id FROM life_review)$q$,'Retain the Property links');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
-- Ordinary Ticket updates keep one review opportunity, including duplicate link retries.
INSERT INTO tickets(id,property_id,title,status,is_demo) VALUES('00000000-0000-4000-9000-000000000091','00000000-0000-4000-9000-000000000021','Private Ticket title','open',false);
UPDATE tickets SET status='in_progress' WHERE id='00000000-0000-4000-9000-000000000091';
SELECT pg_temp.life_assert((SELECT count(*) FROM owner_reviews WHERE ticket_id='00000000-0000-4000-9000-000000000091')=1,'Lifecycle guard broke automatic Ticket coverage');
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT close_owner_opportunity(id,updated_at,'This stays reviewable') FROM owner_reviews WHERE ticket_id='00000000-0000-4000-9000-000000000091'$q$,'stay available');
SELECT close_owner_opportunity(id,updated_at,'No longer needed') FROM owner_reviews WHERE template_id='00000000-0000-4000-9000-000000000082';
RESET ROLE;
-- Raw service writes cannot forge completion or lifecycle history.
SET LOCAL ROLE service_role;
SELECT pg_temp.life_denied($q$UPDATE owner_programs SET status='completed',completion_report='{}'$q$,'checked atomic');
SELECT pg_temp.life_denied($q$INSERT INTO owner_program_events(program_id,kind,summary) SELECT id,'program_completed','forged closeout' FROM life_context$q$,'checked atomic');
RESET ROLE;
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='00000000-0000-4000-9000-000000000003';
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('status',NULL,NULL,NULL,'paused')$q$,'enabled staff');
SELECT pg_temp.life_denied($q$SELECT owner_program_staff_choices()$q$,'Enabled staff');
SELECT pg_temp.life_denied($q$SELECT close_owner_opportunity(id,updated_at,'Blocked disabled actor') FROM owner_reviews WHERE template_id='00000000-0000-4000-9000-000000000081' LIMIT 1$q$,'enabled staff');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.life_denied($q$SELECT complete_owner_program(p.id,'00000000-0000-4000-9000-000000000003',p.report_version,'{}') FROM owner_programs p WHERE p.id IN(SELECT id FROM life_context)$q$,'enabled supervisor');
RESET ROLE;
UPDATE auth.users SET banned_until=NULL WHERE id='00000000-0000-4000-9000-000000000003';
SET LOCAL ROLE service_role;
SELECT complete_owner_program(id,'00000000-0000-4000-9000-000000000003',report_version,'{"generated":"retained report"}') FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011';
SELECT pg_temp.life_denied($q$UPDATE owner_programs SET completion_report='{"forged":true}' WHERE id=(SELECT id FROM life_context)$q$,'immutable');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.life_denied($q$SELECT pg_temp.life_change('status',NULL,NULL,NULL,'active')$q$,'no longer open');
RESET ROLE;
SELECT pg_temp.life_assert((SELECT completion_report->>'generated'='retained report' AND started_on=current_date-3 FROM owner_programs WHERE owner_record_id='00000000-0000-4000-9000-000000000011'),'Closeout changed report/clock');
-- Structural role lock assertion complements single-connection functional tests;
-- real overlapping role insertion vs response still needs PostgreSQL acceptance.
SELECT pg_temp.life_assert(EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='serialize_owner_account_roles' AND tgenabled='O') AND pg_get_functiondef('private.serialize_owner_account_roles()'::regprocedure) LIKE '%FOR UPDATE NOWAIT%','Role/account serialization trigger missing');
ROLLBACK;
