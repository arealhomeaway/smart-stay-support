BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO onboarding_tasks(id,property_id,title,status,owner_approval_status)
 VALUES ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','QA decision','in_progress','not_requested');
SELECT prepare_onboarding_task_approval('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','Version one');
ALTER TABLE onboarding_tasks ADD CONSTRAINT simulate_task_decision_failure CHECK(owner_approval_status <> 'approved');
DO $$ BEGIN
 BEGIN
  PERFORM decide_onboarding_task_approval('88888888-8888-4888-8888-888888888888',true,'Owner approved by email','https://example.invalid/reply');
  RAISE EXCEPTION 'task failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT status FROM approvals) <> 'pending' THEN RAISE EXCEPTION 'approval survived failed task write'; END IF;
END $$;
ALTER TABLE onboarding_tasks DROP CONSTRAINT simulate_task_decision_failure;
SELECT decide_onboarding_task_approval('88888888-8888-4888-8888-888888888888',true,'Owner approved by email','https://example.invalid/reply');
DO $$ BEGIN
 IF (SELECT status FROM approvals) <> 'approved' OR (SELECT owner_approval_status FROM onboarding_tasks WHERE id='88888888-8888-4888-8888-888888888888') <> 'approved' THEN RAISE EXCEPTION 'decision not mirrored'; END IF;
 IF (SELECT evidence_url FROM approvals) <> 'https://example.invalid/reply' THEN RAISE EXCEPTION 'evidence lost'; END IF;
 BEGIN
  PERFORM decide_onboarding_task_approval('88888888-8888-4888-8888-888888888888',false,'Competing response');
  RAISE EXCEPTION 'decision overwritten';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'There must be exactly one%' THEN RAISE; END IF; END;
 IF (SELECT decision_note FROM approvals) <> 'Owner approved by email' THEN RAISE EXCEPTION 'original response overwritten'; END IF;
END $$;
ROLLBACK;
