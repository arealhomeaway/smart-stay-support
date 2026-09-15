BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
INSERT INTO work_orders(id,property_id,title,scope,quote_amount) VALUES('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','Private guest title','Private access code',650);
CREATE FUNCTION fail_work_order_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced history failure'; END $$;
CREATE TRIGGER fail_work_order_history BEFORE INSERT ON work_order_events FOR EACH ROW EXECUTE FUNCTION fail_work_order_history();
DO $$ BEGIN
 BEGIN
  PERFORM prepare_work_order_owner_approval('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','Please approve replacement of the leaking water heater.');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced history failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM approvals WHERE entity_type='work_order') OR EXISTS(SELECT 1 FROM work_orders WHERE approval_id IS NOT NULL) THEN RAISE EXCEPTION 'partial request persisted'; END IF;
END $$;
DROP TRIGGER fail_work_order_history ON work_order_events;
DO $$ DECLARE variant integer; expected text; BEGIN
 FOR variant IN 1..5 LOOP
  expected := CASE variant WHEN 1 THEN 'You do not have access%' WHEN 2 THEN 'Explain the repair%' WHEN 3 THEN 'The Work Order changed%' WHEN 4 THEN 'Record a valid quote%' ELSE 'The Work Order Ticket%' END;
  PERFORM set_config('test.staff',CASE WHEN variant=1 THEN 'false' ELSE 'true' END,true);
  UPDATE work_orders SET quote_amount=CASE WHEN variant=4 THEN NULL ELSE 650 END,
   ticket_id=CASE WHEN variant=5 THEN '66666666-6666-4666-8666-666666666666'::uuid ELSE NULL END;
  BEGIN
   PERFORM prepare_work_order_owner_approval('77777777-7777-4777-8777-777777777777',
    CASE WHEN variant=3 THEN '2026-09-14T00:00:00Z'::timestamptz ELSE '2026-09-15T00:00:00Z'::timestamptz END,
    CASE WHEN variant=2 THEN ' ' ELSE 'Please approve replacement of the leaking water heater.' END);
   RAISE EXCEPTION 'invalid request accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE expected THEN RAISE; END IF; END;
 END LOOP;
 UPDATE work_orders SET ticket_id=NULL;
END $$;
SELECT prepare_work_order_owner_approval('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','Please approve replacement of the leaking water heater.');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM approvals a JOIN work_orders w ON w.approval_id=a.id WHERE a.amount=650 AND a.approver_id='88888888-8888-4888-8888-888888888888' AND a.detail='Please approve replacement of the leaking water heater.' AND a.title='Owner approval — property repair' AND w.approval_status='pending') THEN RAISE EXCEPTION 'canonical request/link incorrect'; END IF;
 IF (SELECT count(*) FROM work_order_events)<>1 THEN RAISE EXCEPTION 'history missing'; END IF;
 BEGIN
  PERFORM prepare_work_order_owner_approval('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','Please approve replacement of the leaking water heater.');
  RAISE EXCEPTION 'duplicate accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'An owner approval already exists%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM approvals WHERE entity_type='work_order')<>1 THEN RAISE EXCEPTION 'duplicate persisted'; END IF;
END $$;
UPDATE owner_program_properties SET inclusion_status='excluded';
INSERT INTO work_orders(id,property_id,title,quote_amount) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','Second repair',800);
SELECT prepare_work_order_owner_approval('66666666-6666-4666-8666-666666666666','2026-09-15T00:00:00Z','Please approve the proposed repair at the quoted amount.');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM approvals WHERE entity_id='66666666-6666-4666-8666-666666666666' AND approver_id IS NOT NULL) THEN RAISE EXCEPTION 'excluded enrollment routed to portal'; END IF;
 IF has_function_privilege('anon','public.prepare_work_order_owner_approval(uuid,timestamptz,text)','EXECUTE') THEN RAISE EXCEPTION 'anonymous execution granted'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.prepare_work_order_owner_approval(uuid,timestamptz,text)'::regprocedure) THEN RAISE EXCEPTION 'request bypasses caller RLS'; END IF;
END $$;
ROLLBACK;
