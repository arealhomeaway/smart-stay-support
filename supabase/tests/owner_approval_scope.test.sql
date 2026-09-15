BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO onboarding_tasks(id,property_id,title,status,owner_approval_status,is_demo)
 VALUES ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','QA scope guard','in_progress','not_requested',false);
SELECT prepare_onboarding_task_approval('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','Owner request');
INSERT INTO financial_requests(id,property_id,title,status,estimate_amount,authority_tier,kind,is_demo)
 VALUES ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','QA scope finance','estimate',500,'owner','repair',false);
SELECT prepare_onboarding_financial_approval('77777777-7777-4777-8777-777777777777',500,'owner');
UPDATE approvals SET approver_id='33333333-3333-4333-8333-333333333333';
DO $$ DECLARE item record; variant integer; BEGIN
 FOR item IN SELECT id,entity_type FROM approvals LOOP
  FOR variant IN 1..3 LOOP
   UPDATE approvals SET approver_role=CASE WHEN variant=1 THEN 'admin' ELSE 'owner' END,
    is_demo=(variant=2) WHERE id=item.id;
   UPDATE onboarding_tasks SET is_demo=(variant=3);
   UPDATE financial_requests SET is_demo=(variant=3);
   BEGIN
    IF item.entity_type='onboarding_task' THEN
     PERFORM record_owner_task_response(item.id,'33333333-3333-4333-8333-333333333333',true,'Must reject');
    ELSE
     PERFORM record_owner_financial_response(item.id,'33333333-3333-4333-8333-333333333333',true,'Must reject');
    END IF;
    RAISE EXCEPTION 'out-of-scope owner response accepted';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The approval changed%' THEN RAISE; END IF; END;
   IF EXISTS(SELECT 1 FROM approvals WHERE id=item.id AND status<>'pending') THEN RAISE EXCEPTION 'rejected response changed approval'; END IF;
   IF EXISTS(SELECT 1 FROM onboarding_tasks WHERE owner_approval_status='approved') THEN RAISE EXCEPTION 'rejected response changed task'; END IF;
   IF EXISTS(SELECT 1 FROM financial_requests WHERE approved_amount IS NOT NULL) THEN RAISE EXCEPTION 'rejected response changed financial amount'; END IF;
  END LOOP;
 END LOOP;
END $$;
ROLLBACK;
