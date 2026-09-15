BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
INSERT INTO work_orders(id,property_id,title,scope,quote_amount) VALUES('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','Private guest title','Private access code',650);
SELECT prepare_work_order_owner_approval('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z','Please approve replacement of the leaking water heater.');
INSERT INTO onboarding_tasks(id,property_id,title,status,owner_approval_status,is_demo)
 VALUES('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Task approval','in_progress','not_requested',false);
SELECT prepare_onboarding_task_approval('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Owner task context');
INSERT INTO financial_requests(id,property_id,title,status,estimate_amount,authority_tier,kind,is_demo)
 VALUES('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','Finance approval','estimate',500,'owner','repair',false);
SELECT prepare_onboarding_financial_approval('44444444-4444-4444-8444-444444444444',500,'owner');
UPDATE approvals SET approver_id='88888888-8888-4888-8888-888888888888';
DO $$ DECLARE item record; BEGIN
 IF has_function_privilege('authenticated','public.record_versioned_owner_response(uuid,uuid,timestamptz,boolean,text)','EXECUTE') THEN RAISE EXCEPTION 'owner can call service wrapper'; END IF;
 FOR item IN SELECT id,updated_at FROM approvals LOOP
  BEGIN
   PERFORM record_versioned_owner_response(item.id,'88888888-8888-4888-8888-888888888888',item.updated_at-interval '1 second',false,'Please revise');
   RAISE EXCEPTION 'stale version accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The approval changed%' THEN RAISE; END IF; END;
  BEGIN
   PERFORM record_versioned_owner_response(item.id,'88888888-8888-4888-8888-888888888888',NULL,false,'Please revise');
   RAISE EXCEPTION 'missing version accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The approval changed%' THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM approvals WHERE id=item.id AND status<>'pending') THEN RAISE EXCEPTION 'stale decision persisted'; END IF;
  PERFORM record_versioned_owner_response(item.id,'88888888-8888-4888-8888-888888888888',item.updated_at,false,'Please revise');
  IF NOT EXISTS(SELECT 1 FROM approvals WHERE id=item.id AND status='declined') THEN RAISE EXCEPTION 'current response not delegated'; END IF;
 END LOOP;
END $$;
ROLLBACK;
