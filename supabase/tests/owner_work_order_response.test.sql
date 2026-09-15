BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
INSERT INTO work_orders(id,property_id,title,scope,quote_amount) VALUES('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','Private guest title','Private access code',650);
SELECT prepare_work_order_owner_approval('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','Please approve replacement of the leaking water heater.');
DO $$ DECLARE request_id uuid; variant integer; expected text; BEGIN
 SELECT approval_id INTO request_id FROM work_orders;
 IF has_function_privilege('authenticated','public.record_owner_work_order_response(uuid,uuid,boolean,text)','EXECUTE') OR has_function_privilege('anon','public.record_owner_work_order_response(uuid,uuid,boolean,text)','EXECUTE') THEN RAISE EXCEPTION 'owner can call service operation'; END IF;
 FOR variant IN 1..8 LOOP
  UPDATE properties SET owner_record_id='11111111-1111-4111-8111-111111111111';
  UPDATE work_orders SET is_demo=(variant=2),quote_amount=CASE WHEN variant=3 THEN 700 ELSE 650 END;
  UPDATE owner_program_properties SET inclusion_status=CASE WHEN variant=4 THEN 'excluded' ELSE 'included' END;
  UPDATE property_owners SET active=(variant<>5);
  UPDATE owner_programs SET status=CASE WHEN variant=6 THEN 'completed' ELSE 'active' END WHERE id='55555555-5555-4555-8555-555555555555';

  UPDATE approvals SET approver_role=CASE WHEN variant=8 THEN 'admin' ELSE 'owner' END WHERE id=request_id;
  UPDATE properties SET owner_record_id=CASE WHEN variant=7 THEN NULL ELSE '11111111-1111-4111-8111-111111111111'::uuid END;
  expected:=CASE variant WHEN 1 THEN 'That Work Order approval%' WHEN 2 THEN 'That Work Order no longer%' WHEN 3 THEN 'The quoted amount changed%' WHEN 4 THEN 'This Property is no longer enrolled%' WHEN 5 THEN 'The canonical Owner%' WHEN 6 THEN 'This Property is no longer enrolled%' WHEN 7 THEN 'This Property is no longer available%' ELSE 'The approval changed%' END;
  BEGIN
   PERFORM record_owner_work_order_response(request_id,CASE WHEN variant=1 THEN '99999999-9999-4999-8999-999999999999'::uuid ELSE '88888888-8888-4888-8888-888888888888'::uuid END,true,'Approved');
   RAISE EXCEPTION 'invalid owner decision accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE expected THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM approvals WHERE id=request_id AND status<>'pending') OR EXISTS(SELECT 1 FROM work_orders WHERE approved_amount IS NOT NULL) THEN RAISE EXCEPTION 'rejected decision mutated records'; END IF;
 END LOOP;
 UPDATE approvals SET approver_role='owner' WHERE id=request_id;
END $$;
CREATE FUNCTION fail_owner_work_order_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced audit failure'; END $$;
CREATE TRIGGER fail_owner_work_order_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_owner_work_order_audit();
DO $$ DECLARE request_id uuid; BEGIN
 SELECT approval_id INTO request_id FROM work_orders;
 BEGIN
  PERFORM record_owner_work_order_response(request_id,'88888888-8888-4888-8888-888888888888',true,'Approved');
  RAISE EXCEPTION 'audit failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced audit failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM approvals WHERE id=request_id AND status<>'pending') OR EXISTS(SELECT 1 FROM work_orders WHERE approved_amount IS NOT NULL) OR EXISTS(SELECT 1 FROM work_order_events WHERE event_type='owner_approval_approved') THEN RAISE EXCEPTION 'partial response persisted'; END IF;
END $$;
DROP TRIGGER fail_owner_work_order_audit ON audit_log;
DO $$ DECLARE request_id uuid; BEGIN
 SELECT approval_id INTO request_id FROM work_orders;
 PERFORM record_owner_work_order_response(request_id,'88888888-8888-4888-8888-888888888888',true,'Approved');
 IF NOT EXISTS(SELECT 1 FROM work_orders WHERE approval_status='approved' AND approved_amount=650 AND approval_note='Approved') OR NOT EXISTS(SELECT 1 FROM approvals WHERE id=request_id AND status='approved') OR (SELECT count(*) FROM audit_log)<>1 THEN RAISE EXCEPTION 'decision mirrors or audit missing'; END IF;
 BEGIN
  PERFORM record_owner_work_order_response(request_id,'88888888-8888-4888-8888-888888888888',false,'Late decline');
  RAISE EXCEPTION 'duplicate decision accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The approval changed%' THEN RAISE; END IF; END;
END $$;
INSERT INTO work_orders(id,property_id,title,quote_amount) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','Other repair',800);
DO $$ DECLARE request_id uuid; BEGIN
 request_id:=prepare_work_order_owner_approval('66666666-6666-4666-8666-666666666666','2026-09-15T00:00:00Z','Please approve the proposed repair at the quoted amount.');
 PERFORM record_owner_work_order_response(request_id,'88888888-8888-4888-8888-888888888888',false,'Please revise the proposal.');
 IF NOT EXISTS(SELECT 1 FROM work_orders WHERE id='66666666-6666-4666-8666-666666666666' AND approval_status='declined' AND approved_amount IS NULL) THEN RAISE EXCEPTION 'decline authorized spending'; END IF;
END $$;
ROLLBACK;
