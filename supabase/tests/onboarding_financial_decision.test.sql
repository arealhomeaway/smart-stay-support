BEGIN;
SELECT set_config('test.actor', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('test.staff', 'true', true);
INSERT INTO approvals VALUES ('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222',
 'financial_request','77777777-7777-4777-8777-777777777777','pending',null,null);
INSERT INTO financial_requests(id, property_id, project_id, approval_id, title, status, estimate_amount, invoice_amount)
VALUES ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666', 'Repair','awaiting_approval',300,325);
ALTER TABLE onboarding_project_events ADD CONSTRAINT simulate_financial_history_failure CHECK (new_value <> '999');
DO $$ BEGIN
  BEGIN
    PERFORM decide_onboarding_financial_request('77777777-7777-4777-8777-777777777777',true,'Verified owner decision',999);
    RAISE EXCEPTION 'history failure allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT status FROM approvals) <> 'pending' THEN RAISE EXCEPTION 'partial approval write'; END IF;
  IF (SELECT approved_amount FROM financial_requests) IS NOT NULL THEN RAISE EXCEPTION 'partial amount write'; END IF;
END $$;
SELECT decide_onboarding_financial_request('77777777-7777-4777-8777-777777777777',true,'Verified owner decision',310);
UPDATE financial_requests SET actual_amount = 320;
DO $$ BEGIN
  IF (SELECT estimate_amount FROM financial_requests) <> 300 OR
     (SELECT approved_amount FROM financial_requests) <> 310 OR
     (SELECT invoice_amount FROM financial_requests) <> 325 OR
     (SELECT actual_amount FROM financial_requests) <> 320 THEN RAISE EXCEPTION 'financial amounts were conflated'; END IF;
  IF (SELECT status FROM approvals) <> 'approved' THEN RAISE EXCEPTION 'canonical approval not updated'; END IF;
  BEGIN
    PERFORM decide_onboarding_financial_request('77777777-7777-4777-8777-777777777777',true,'Revised amount',400);
    RAISE EXCEPTION 'approved amount overwritten';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'This request already has a decision.%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
