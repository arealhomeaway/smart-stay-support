BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO onboarding_tasks(id,property_id,title,status,owner_approval_status)
 VALUES ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','QA mood board','in_progress','not_requested');
DO $$ DECLARE first_id uuid; retry_id uuid; BEGIN
 first_id := prepare_onboarding_task_approval('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','Version one');
 retry_id := prepare_onboarding_task_approval('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','Retry must not overwrite');
 IF first_id IS DISTINCT FROM retry_id OR (SELECT count(*) FROM approvals) <> 1 THEN RAISE EXCEPTION 'duplicate approval created'; END IF;
 IF (SELECT detail FROM approvals WHERE id=first_id) <> 'Version one' THEN RAISE EXCEPTION 'original decision context overwritten'; END IF;
 IF (SELECT owner_approval_status FROM onboarding_tasks WHERE id='88888888-8888-4888-8888-888888888888') <> 'awaiting_owner' THEN RAISE EXCEPTION 'waiting state not recorded'; END IF;
 BEGIN
  PERFORM prepare_onboarding_task_approval('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','Wrong property');
  RAISE EXCEPTION 'wrong property accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That task is not available%' THEN RAISE; END IF; END;
 UPDATE onboarding_tasks SET owner_approval_status='approved';
 BEGIN
  PERFORM prepare_onboarding_task_approval('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','Repeat');
  RAISE EXCEPTION 'approved task reset';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This task does not need%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
