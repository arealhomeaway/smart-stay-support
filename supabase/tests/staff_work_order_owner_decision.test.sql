BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
INSERT INTO work_orders(id,property_id,title,scope,quote_amount) VALUES('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','Private guest title','Private access code',650);
SELECT prepare_work_order_owner_approval('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','Please approve replacement of the leaking water heater.');
DO $$ DECLARE variant integer; expected text; BEGIN
 FOR variant IN 1..6 LOOP
  PERFORM set_config('test.staff',CASE WHEN variant=1 THEN 'false' ELSE 'true' END,true);
  UPDATE approvals SET approver_role=CASE WHEN variant=6 THEN 'admin' ELSE 'owner' END;
  expected:=CASE variant WHEN 1 THEN 'You do not have access%' WHEN 2 THEN 'Record the owner response%' WHEN 3 THEN 'The Work Order changed%' WHEN 4 THEN 'Record the owner-approved amount%' WHEN 5 THEN 'A decline or information request%' ELSE 'The canonical approval changed%' END;
  BEGIN
   PERFORM record_staff_work_order_owner_decision('77777777-7777-4777-8777-777777777777',
    CASE WHEN variant=3 THEN '2026-09-14T00:00:00Z'::timestamptz ELSE '2026-09-15T00:00:00Z'::timestamptz END,
    CASE WHEN variant=5 THEN 'declined' ELSE 'approved' END,
    CASE WHEN variant=4 THEN 651 ELSE 650 END,CASE WHEN variant=2 THEN ' ' ELSE 'Owner email approves repair.' END);
   RAISE EXCEPTION 'invalid staff response accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE expected THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM approvals WHERE status<>'pending') OR EXISTS(SELECT 1 FROM work_orders WHERE approved_amount IS NOT NULL) THEN RAISE EXCEPTION 'invalid response changed state'; END IF;
 END LOOP;
 UPDATE approvals SET approver_role='owner';
END $$;
CREATE FUNCTION fail_staff_wo_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced history failure'; END $$;
CREATE TRIGGER fail_staff_wo_history BEFORE INSERT ON work_order_events FOR EACH ROW EXECUTE FUNCTION fail_staff_wo_history();
DO $$ BEGIN
 BEGIN
  PERFORM record_staff_work_order_owner_decision('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','approved',600,'Owner email approves up to 600.');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced history failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM approvals WHERE status<>'pending' OR recorded_by IS NOT NULL) OR EXISTS(SELECT 1 FROM work_orders WHERE approved_amount IS NOT NULL) THEN RAISE EXCEPTION 'partial staff decision'; END IF;
END $$;
DROP TRIGGER fail_staff_wo_history ON work_order_events;
SELECT record_staff_work_order_owner_decision('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','info_requested',NULL,'Owner email asks for another quote.');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM approvals WHERE status='pending' AND decided_at IS NULL) OR NOT EXISTS(SELECT 1 FROM work_orders WHERE approval_status='info_requested' AND approved_amount IS NULL) THEN RAISE EXCEPTION 'information request granted approval'; END IF;
END $$;
SELECT record_staff_work_order_owner_decision('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','approved',600,'Owner email approves up to 600.');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM approvals WHERE status='approved' AND amount=650 AND recorded_by='99999999-9999-4999-8999-999999999999' AND response_channel='staff_recorded') OR NOT EXISTS(SELECT 1 FROM work_orders WHERE approval_status='approved' AND approved_amount=600) THEN RAISE EXCEPTION 'response provenance or amount lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM work_order_events WHERE event_type='owner_approved' AND detail->>'note'='Owner email approves up to 600.' AND detail->'previous_approval'->>'status'='pending') THEN RAISE EXCEPTION 'previous approval evidence missing'; END IF;
 BEGIN
  PERFORM record_staff_work_order_owner_decision('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','declined',NULL,'Late conflicting response');
  RAISE EXCEPTION 'duplicate accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The canonical approval changed%' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public.record_staff_work_order_owner_decision(uuid,timestamptz,text,numeric,text)','EXECUTE') THEN RAISE EXCEPTION 'anonymous execution allowed'; END IF;
END $$;
ROLLBACK;
