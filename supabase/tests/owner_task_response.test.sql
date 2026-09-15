BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO onboarding_tasks(id,property_id,title,status,owner_approval_status,is_demo)
 VALUES ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','QA owner response','in_progress','not_requested',false);
SELECT prepare_onboarding_task_approval('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','Version one');
UPDATE approvals SET approver_id='33333333-3333-4333-8333-333333333333';
ALTER TABLE onboarding_tasks ADD CONSTRAINT simulate_owner_response_failure CHECK(owner_approval_status <> 'approved');
DO $$ DECLARE request_id uuid; BEGIN
 SELECT id INTO request_id FROM approvals;
 IF has_function_privilege('authenticated','public.record_owner_task_response(uuid,uuid,boolean,text)','EXECUTE') THEN RAISE EXCEPTION 'owner can call elevated operation'; END IF;
 BEGIN
  PERFORM record_owner_task_response(request_id,'44444444-4444-4444-8444-444444444444',true,'Wrong owner');
  RAISE EXCEPTION 'wrong owner allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That task approval is not addressed%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM record_owner_task_response(request_id,'33333333-3333-4333-8333-333333333333',true,'Looks good');
  RAISE EXCEPTION 'task failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT status FROM approvals) <> 'pending' THEN RAISE EXCEPTION 'partial decision persisted'; END IF;
END $$;
ALTER TABLE onboarding_tasks DROP CONSTRAINT simulate_owner_response_failure;
DO $$ DECLARE request_id uuid; BEGIN
 SELECT id INTO request_id FROM approvals;
 PERFORM record_owner_task_response(request_id,'33333333-3333-4333-8333-333333333333',false,'Please revise colors');
 IF (SELECT owner_approval_status FROM onboarding_tasks WHERE id='88888888-8888-4888-8888-888888888888') <> 'changes_requested' THEN RAISE EXCEPTION 'task not returned'; END IF;
 BEGIN
  PERFORM record_owner_task_response(request_id,'33333333-3333-4333-8333-333333333333',true,'Second response');
  RAISE EXCEPTION 'response overwritten';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The approval changed%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
