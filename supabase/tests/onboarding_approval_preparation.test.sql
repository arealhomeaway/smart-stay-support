BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO financial_requests(id,property_id,title,status,estimate_amount,authority_tier,kind)
 VALUES ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','QA repair','estimate',500,'owner','repair');
ALTER TABLE financial_requests ADD CONSTRAINT simulate_link_failure CHECK (approval_id IS NULL);
DO $$ BEGIN
 BEGIN
  PERFORM prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',500,'owner');
  RAISE EXCEPTION 'link failure ignored';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF EXISTS (SELECT 1 FROM approvals) THEN RAISE EXCEPTION 'orphan approval survived rollback'; END IF;
END $$;
ALTER TABLE financial_requests DROP CONSTRAINT simulate_link_failure;
DO $$ DECLARE first_id uuid; retry_id uuid; BEGIN
 first_id := prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',500,'owner');
 retry_id := prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',500,'owner');
 IF first_id IS DISTINCT FROM retry_id OR (SELECT count(*) FROM approvals) <> 1 THEN RAISE EXCEPTION 'retry created another approval'; END IF;
 IF (SELECT approval_id FROM financial_requests) IS DISTINCT FROM first_id THEN RAISE EXCEPTION 'canonical link missing'; END IF;
 BEGIN
  PERFORM prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',501,'owner');
  RAISE EXCEPTION 'stale estimate allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'The request or its authority changed.%' THEN RAISE; END IF;
 END;
 UPDATE approvals SET status='approved';
 BEGIN
  PERFORM prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',500,'owner');
  RAISE EXCEPTION 'decided approval reused';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'The linked approval changed.%' THEN RAISE; END IF;
 END;
END $$;
SELECT set_config('test.staff','false',true);
DO $$ BEGIN
 BEGIN
  PERFORM prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',500,'owner');
  RAISE EXCEPTION 'unauthorized preparation allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'You do not have access%' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
