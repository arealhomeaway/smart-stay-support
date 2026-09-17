BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.must_fail(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
  IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected rejection: %',SQLERRM; END IF; RETURN;
 END;
 RAISE EXCEPTION 'Unsafe statement succeeded: %',statement;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.assert_true(value boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
UPDATE functional_roles SET current_seat_holder='00000000-0000-4000-8000-000000000004' WHERE code='director_onboarding';
UPDATE functional_roles SET current_seat_holder='00000000-0000-4000-8000-000000000008' WHERE code='director_ops';
UPDATE functional_roles SET current_seat_holder='00000000-0000-4000-8000-000000000009' WHERE code='ops_supervisor';
INSERT INTO properties(id,lifecycle_status,is_demo,active,onboarding_owner) VALUES('00000000-0000-4000-8000-000000000401','onboarding',false,false,'00000000-0000-4000-8000-000000000006');
INSERT INTO onboarding_projects(id,property_id,project_manager,director,started_by,is_demo) VALUES('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000006',auth.uid(),false);
INSERT INTO onboarding_tasks(id,property_id,stage,status,title,blocks_handoff,requires_owner_approval,evidence_required) VALUES('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000401','phase1_inspection','complete','Inspection',true,false,false);

SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
SELECT pg_temp.assert_true((SELECT NOT can_review_stages AND NOT kati_review AND NOT micah_review AND NOT operations_acceptance AND NOT live_confirmation FROM read_onboarding_review_capabilities()),'Generic manager must not own any protected gate');
SELECT pg_temp.must_fail($q$SELECT read_onboarding_handoff_snapshot('00000000-0000-4000-8000-000000000401')$q$,'not assigned');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000006',true);
SELECT pg_temp.must_fail($q$SELECT read_onboarding_handoff_snapshot('00000000-0000-4000-8000-000000000401')$q$,'not assigned');
SELECT pg_temp.must_fail($q$UPDATE properties SET handoff_accepted_at=now() WHERE id='00000000-0000-4000-8000-000000000401'$q$,'handoff review chain');
SELECT pg_temp.must_fail($q$UPDATE properties SET lifecycle_status='active_operations' WHERE id='00000000-0000-4000-8000-000000000401'$q$,'handoff review chain');
SELECT pg_temp.must_fail($q$UPDATE properties SET active=true WHERE id='00000000-0000-4000-8000-000000000401'$q$,'handoff review chain');
SELECT pg_temp.must_fail($q$UPDATE onboarding_projects SET status='complete' WHERE id='00000000-0000-4000-8000-000000000402'$q$,'handoff review chain');
SELECT pg_temp.must_fail($q$INSERT INTO property_handoffs(property_id,status,gate_step) VALUES('00000000-0000-4000-8000-000000000401','accepted','complete')$q$,'permission denied');
SELECT pg_temp.must_fail($q$INSERT INTO handoff_reviews(property_id,step,decision) VALUES('00000000-0000-4000-8000-000000000401','kati_review','accepted')$q$,'permission denied');
SELECT pg_temp.must_fail($q$SELECT record_onboarding_stage_capture('00000000-0000-4000-8000-000000000402',auth.uid(),0,'{}','[]','{}')$q$,'permission denied');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000004',true);
SELECT pg_temp.assert_true((SELECT can_review_stages AND kati_review AND NOT micah_review AND NOT operations_acceptance FROM read_onboarding_review_capabilities()),'Onboarding Director must own only their protected gates');
SELECT pg_temp.assert_true(read_onboarding_handoff_snapshot('00000000-0000-4000-8000-000000000401')->'project'->>'id'='00000000-0000-4000-8000-000000000402','Protected reviewers can read the actual project without Property PM assignment');
RESET ROLE;

CREATE FUNCTION pg_temp.capture(actor uuid,revision integer,status text,observation text DEFAULT 'Reviewed inspection findings', evidence jsonb DEFAULT '["00000000-0000-4000-8000-000000000480"]'::jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb; scope jsonb;
BEGIN
 SELECT jsonb_build_object('modules',modules,'furnishing_scope',furnishing_scope,'director',director) INTO scope FROM onboarding_projects WHERE id='00000000-0000-4000-8000-000000000402';
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') INTO snapshot FROM onboarding_tasks t WHERE property_id='00000000-0000-4000-8000-000000000401' AND stage='phase1_inspection' AND archived_at IS NULL;
 PERFORM record_onboarding_stage_capture('00000000-0000-4000-8000-000000000402',actor,revision,jsonb_build_object('stage','phase1_inspection','actor',actor,'revision',revision+1,'status',status,'observation',observation,'evidenceIds',evidence,'reason','Review action'),snapshot,scope);
END $$;
SELECT pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',0,'complete')$q$,'Submit a stage');
SELECT pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000006',0,'awaiting_review')$q$,'current PM');
SAVEPOINT evidence_validation;
INSERT INTO documents(id,entity_type,entity_id,is_demo,upload_status,storage_path) VALUES('00000000-0000-4000-8000-000000000480','property','00000000-0000-4000-8000-000000000401',false,'stored','property/evidence.pdf');
DO $$ DECLARE mutation text; BEGIN
 FOREACH mutation IN ARRAY ARRAY['deleted_at=now()','archived_at=now()','upload_status=''pending''','upload_status=''failed''','is_demo=true','storage_path=null'] LOOP
  EXECUTE 'UPDATE documents SET deleted_at=null,archived_at=null,upload_status=''stored'',is_demo=false,storage_path=''property/evidence.pdf'' WHERE id=''00000000-0000-4000-8000-000000000480''';
  EXECUTE 'UPDATE documents SET '||mutation||' WHERE id=''00000000-0000-4000-8000-000000000480''';
  PERFORM pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000003',0,'draft','Document evidence','["00000000-0000-4000-8000-000000000480"]')$q$,'Evidence must be stored');
 END LOOP;
END $$;
UPDATE documents SET storage_path=null,external_url='https://example.test/inspection' WHERE id='00000000-0000-4000-8000-000000000480';
SELECT pg_temp.capture('00000000-0000-4000-8000-000000000003',0,'draft','Document evidence','["00000000-0000-4000-8000-000000000480"]');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM onboarding_project_events WHERE project_id='00000000-0000-4000-8000-000000000402'),'Valid available external evidence is retained in a stage receipt');
ROLLBACK TO evidence_validation;
INSERT INTO documents(id,entity_type,entity_id,is_demo,upload_status,storage_path) VALUES('00000000-0000-4000-8000-000000000480','property','00000000-0000-4000-8000-000000000401',false,'stored','property/evidence.pdf');
SELECT pg_temp.capture('00000000-0000-4000-8000-000000000003',0,'awaiting_review');
SELECT pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000006',1,'complete')$q$,'Director of Onboarding');
SELECT pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000002',1,'complete')$q$,'Director of Onboarding');
SELECT pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',1,'complete','Silently rewritten findings')$q$,'exact submitted');
SAVEPOINT changed_submitted_evidence;
UPDATE documents SET storage_path='property/replaced.pdf' WHERE id='00000000-0000-4000-8000-000000000480';
SELECT pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',1,'complete')$q$,'Stage evidence changed');
ROLLBACK TO changed_submitted_evidence;
SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',1,'complete');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM onboarding_project_events WHERE project_id='00000000-0000-4000-8000-000000000402'),'Submit and Director review must be distinct durable revisions');

CREATE FUNCTION pg_temp.request_payload() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('snapshot',private.onboarding_handoff_snapshot('00000000-0000-4000-8000-000000000401'),'checklist','[]'::jsonb,'validation',jsonb_build_object('ready',true),'openTaskIds',(SELECT coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb) FROM onboarding_tasks WHERE property_id='00000000-0000-4000-8000-000000000401' AND archived_at IS NULL AND status<>'complete'),'applicableTaskIds',jsonb_build_array('00000000-0000-4000-8000-000000000403'),'carryoverAccepted',true)
$$;
SELECT pg_temp.must_fail($q$SELECT create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000004','onboarding',pg_temp.request_payload())$q$,'current PM');
DO $$ DECLARE snapshot jsonb:=pg_temp.request_payload(); BEGIN
 UPDATE onboarding_tasks SET title='Changed inspection' WHERE id='00000000-0000-4000-8000-000000000403';
 BEGIN
  PERFORM create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','onboarding',snapshot);
  RAISE EXCEPTION 'Stale readiness was accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Readiness changed.%' THEN RAISE; END IF; END;
END $$;
-- Changed work requires a renewed capture; PM and Director may be the same
-- person but submission and approval remain separate actions.
SELECT pg_temp.must_fail($q$SELECT create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','onboarding',pg_temp.request_payload())$q$,'current work and scope');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
UPDATE onboarding_projects SET project_manager='00000000-0000-4000-8000-000000000004' WHERE id='00000000-0000-4000-8000-000000000402';
UPDATE onboarding_tasks SET status='carryover',assigned_to='00000000-0000-4000-8000-000000000003',due_on='2026-09-30',carryover_reason='Accepted planned follow-up' WHERE id='00000000-0000-4000-8000-000000000403';
SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',2,'correction_required');
SELECT pg_temp.must_fail($q$SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',3,'complete')$q$,'Submit a stage');
SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',3,'awaiting_review');
SELECT pg_temp.capture('00000000-0000-4000-8000-000000000004',4,'complete');
UPDATE onboarding_projects SET project_manager='00000000-0000-4000-8000-000000000003' WHERE id='00000000-0000-4000-8000-000000000402';
SELECT pg_temp.must_fail($q$SELECT create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','onboarding',jsonb_set(pg_temp.request_payload(),'{carryoverAccepted}','false'))$q$,'explicit accepted carryover');
SELECT pg_temp.must_fail($q$SELECT create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','onboarding',jsonb_set(pg_temp.request_payload(),'{openTaskIds}','[]'))$q$,'every applicable carryover');
SAVEPOINT changed_reviewed_evidence;
UPDATE documents SET storage_path='property/replaced-after-review.pdf' WHERE id='00000000-0000-4000-8000-000000000480';
SELECT pg_temp.must_fail($q$SELECT create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','onboarding',pg_temp.request_payload())$q$,'current work and scope');
DELETE FROM documents WHERE id='00000000-0000-4000-8000-000000000480';
SELECT pg_temp.must_fail($q$SELECT create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','onboarding',pg_temp.request_payload())$q$,'current work and scope');
ROLLBACK TO changed_reviewed_evidence;
SELECT set_config('test.handoff',create_onboarding_handoff('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','onboarding',pg_temp.request_payload())::text,true);
SAVEPOINT changed_handoff_evidence;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000004',true);
DO $$ DECLARE mutation text; BEGIN
 FOREACH mutation IN ARRAY ARRAY['deleted_at=now()','archived_at=now()','upload_status=''pending''','upload_status=''failed''','is_demo=true','storage_path=''property/replaced.pdf''','external_url=''https://example.test/changed'''] LOOP
  EXECUTE 'UPDATE documents SET deleted_at=null,archived_at=null,upload_status=''stored'',is_demo=false,storage_path=''property/evidence.pdf'',external_url=null WHERE id=''00000000-0000-4000-8000-000000000480''';
  EXECUTE 'UPDATE documents SET '||mutation||' WHERE id=''00000000-0000-4000-8000-000000000480''';
  PERFORM pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'kati_review','accepted')$q$,'submitted readiness record changed');
 END LOOP;
END $$;
DELETE FROM documents WHERE id='00000000-0000-4000-8000-000000000480';
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'kati_review','accepted')$q$,'submitted readiness record changed');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM handoff_reviews WHERE handoff_id=current_setting('test.handoff')::uuid),'Mutated evidence must not leave decision history');
ROLLBACK TO changed_handoff_evidence;

SELECT pg_temp.assert_true((SELECT open_task_ids=ARRAY['00000000-0000-4000-8000-000000000403'::uuid] AND carryover_accepted FROM property_handoffs WHERE id=current_setting('test.handoff')::uuid),'Already-designated carryover must remain in the handoff');
SAVEPOINT legacy_handoff_recovery;
UPDATE property_handoffs SET validation=validation-'readinessSnapshot' WHERE id=current_setting('test.handoff')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000004',true);
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'kati_review','accepted')$q$,'submitted readiness record changed');
SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'kati_review','returned','Rebuild the missing readiness receipt');
SELECT pg_temp.assert_true((SELECT lifecycle_status='handoff_corrections' AND handoff_accepted_at IS NULL FROM properties WHERE id='00000000-0000-4000-8000-000000000401'),'Legacy or stale handoff can be returned for a new review');
RESET ROLE;
ROLLBACK TO legacy_handoff_recovery;

SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
SELECT pg_temp.must_fail($q$UPDATE onboarding_tasks SET title='Tampered while in review' WHERE id='00000000-0000-4000-8000-000000000403'$q$,'Return the handoff');
SELECT pg_temp.must_fail($q$UPDATE property_handoffs SET gate_step='complete' WHERE id=current_setting('test.handoff')::uuid$q$,'permission denied');
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'kati_review','accepted')$q$,'responsibility for this review gate');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000004',true);
SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'kati_review','accepted');
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'kati_review','accepted')$q$,'handoff advanced');
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'micah_review','accepted')$q$,'responsibility for this review gate');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000008',true);
RESET ROLE;
INSERT INTO property_fact_proposals(id,property_id,status) VALUES('00000000-0000-4000-8000-000000000410','00000000-0000-4000-8000-000000000401','pending');
SET LOCAL ROLE authenticated;
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'micah_review','accepted')$q$,'submitted readiness record changed');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM handoff_reviews WHERE handoff_id=current_setting('test.handoff')::uuid),'A changed readiness record must not leave a partial review');
RESET ROLE;
DELETE FROM property_fact_proposals WHERE id='00000000-0000-4000-8000-000000000410';
SET LOCAL ROLE authenticated;
SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'micah_review','accepted');
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'operations_acceptance','accepted')$q$,'responsibility for this review gate');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000009',true);
SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'operations_acceptance','accepted');
SELECT pg_temp.assert_true((SELECT NOT active AND lifecycle_status='handoff_requested' AND handoff_accepted_at IS NOT NULL FROM properties WHERE id='00000000-0000-4000-8000-000000000401'),'Operations acceptance must retain a separate Live action');
RESET ROLE;
ALTER TABLE properties ADD CONSTRAINT review_fixture_live_failure CHECK(id<>'00000000-0000-4000-8000-000000000401' OR NOT active);
SET LOCAL ROLE authenticated;
SELECT pg_temp.must_fail($q$SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'live_confirmation','accepted')$q$,'check constraint');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM handoff_reviews WHERE handoff_id=current_setting('test.handoff')::uuid),'A failed lifecycle write must roll back its decision history');
RESET ROLE;
ALTER TABLE properties DROP CONSTRAINT review_fixture_live_failure;
SET LOCAL ROLE authenticated;
SELECT review_onboarding_handoff(current_setting('test.handoff')::uuid,'live_confirmation','accepted');
SELECT pg_temp.assert_true((SELECT active AND lifecycle_status='active_operations' FROM properties WHERE id='00000000-0000-4000-8000-000000000401'),'Authorized Supervisor Live must finish the property transition');
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM handoff_reviews WHERE handoff_id=current_setting('test.handoff')::uuid),'All four explicit role-specific review actions must be retained');
RESET ROLE;
ROLLBACK;
