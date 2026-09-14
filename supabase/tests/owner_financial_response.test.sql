BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO financial_requests(id,property_id,title,status,estimate_amount,authority_tier,kind)
 VALUES ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','QA owner finance','estimate',500,'owner','repair');
SELECT prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',500,'owner');
UPDATE approvals SET approver_id='33333333-3333-4333-8333-333333333333';
ALTER TABLE financial_requests ADD CONSTRAINT simulate_owner_finance_failure CHECK(approved_amount IS NULL);
DO $$ DECLARE request_id uuid; BEGIN
 SELECT id INTO request_id FROM approvals;
 IF has_function_privilege('authenticated','public.record_owner_financial_response(uuid,uuid,boolean,text)','EXECUTE') THEN RAISE EXCEPTION 'owner can call elevated operation'; END IF;
 BEGIN
  PERFORM record_owner_financial_response(request_id,'44444444-4444-4444-8444-444444444444',true,'Wrong owner');
  RAISE EXCEPTION 'wrong owner allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That financial approval is not addressed%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM record_owner_financial_response(request_id,'33333333-3333-4333-8333-333333333333',true,'Approved');
  RAISE EXCEPTION 'write failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT status FROM approvals) <> 'pending' THEN RAISE EXCEPTION 'partial decision persisted'; END IF;
 UPDATE financial_requests SET estimate_amount=600;
 BEGIN
  PERFORM record_owner_financial_response(request_id,'33333333-3333-4333-8333-333333333333',true,'Approved');
  RAISE EXCEPTION 'changed amount accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The requested amount changed%' THEN RAISE; END IF; END;
 UPDATE financial_requests SET estimate_amount=500;
END $$;
ALTER TABLE financial_requests DROP CONSTRAINT simulate_owner_finance_failure;
DO $$ DECLARE request_id uuid; BEGIN
 SELECT id INTO request_id FROM approvals;
 PERFORM record_owner_financial_response(request_id,'33333333-3333-4333-8333-333333333333',true,'Approved');
 IF (SELECT approved_amount FROM financial_requests) <> 500 OR (SELECT status FROM approvals) <> 'approved' THEN RAISE EXCEPTION 'approved amount not recorded'; END IF;
 BEGIN
  PERFORM record_owner_financial_response(request_id,'33333333-3333-4333-8333-333333333333',false,'Second response');
  RAISE EXCEPTION 'response overwritten';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That financial request no longer%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
