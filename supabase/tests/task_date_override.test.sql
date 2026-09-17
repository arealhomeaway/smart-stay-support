BEGIN;
SELECT set_config('test.staff','true',true), set_config('test.supervisor','false',true);
INSERT INTO properties(id,lifecycle_status,is_demo) VALUES('11111111-1111-4111-8111-111111111111','onboarding',true);
INSERT INTO onboarding_projects(id,property_id,project_manager,status) VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','active');
INSERT INTO onboarding_tasks(id,property_id,title,stage,status,due_on,updated_at) VALUES('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Date test','intake','open','2026-09-01','2026-01-01');
DO $$ BEGIN
 IF has_function_privilege('authenticated','override_onboarding_task_date(uuid,uuid,timestamptz,date,text)','EXECUTE') THEN RAISE EXCEPTION 'owner can invoke date override'; END IF;
 BEGIN
  PERFORM override_onboarding_task_date('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','2026-01-01','2026-09-03','Delivery moved');
  RAISE EXCEPTION 'unrelated actor allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only this project lead%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM override_onboarding_task_date('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','2026-01-01','2026-09-03','');
  RAISE EXCEPTION 'missing reason allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Record why%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM override_onboarding_task_date('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','2026-01-02','2026-09-03','Delivery moved');
  RAISE EXCEPTION 'stale version allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This task changed%' THEN RAISE; END IF; END;
END $$;
ALTER TABLE onboarding_project_events ADD CONSTRAINT simulate_date_history_failure CHECK(kind<>'task_date_overridden');
DO $$ BEGIN
 BEGIN
  PERFORM override_onboarding_task_date('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','2026-01-01','2026-09-03','Delivery moved');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM onboarding_tasks WHERE due_on<>'2026-09-01' OR due_on_overridden OR updated_at<>'2026-01-01') THEN RAISE EXCEPTION 'partial date update'; END IF;
END $$;
ALTER TABLE onboarding_project_events DROP CONSTRAINT simulate_date_history_failure;
INSERT INTO onboarding_project_events(project_id,property_id,kind,new_value) VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','stage_capture:intake','{"revision":1,"status":"awaiting_review"}');
DO $$ BEGIN
 BEGIN
  PERFORM override_onboarding_task_date('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','2026-01-01','2026-09-03','Delivery moved');
  RAISE EXCEPTION 'stage review bypassed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Return or reopen the stage%' THEN RAISE; END IF; END;
END $$;
INSERT INTO onboarding_project_events(project_id,property_id,kind,new_value) VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','stage_capture:intake','{"revision":2,"status":"draft"}');
UPDATE properties SET lifecycle_status='handoff_requested';
DO $$ BEGIN
 BEGIN
  PERFORM override_onboarding_task_date('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','2026-01-01','2026-09-03','Delivery moved');
  RAISE EXCEPTION 'handoff bypassed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Return the handoff%' THEN RAISE; END IF; END;
END $$;
UPDATE properties SET lifecycle_status='onboarding';
SELECT override_onboarding_task_date('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','2026-01-01','2026-09-03','Delivery moved');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM onboarding_tasks WHERE due_on='2026-09-03' AND due_on_overridden AND due_on_source='manual') THEN RAISE EXCEPTION 'manual override not retained'; END IF;
 IF NOT EXISTS(SELECT 1 FROM onboarding_project_events WHERE kind='task_date_overridden' AND prior_value='2026-09-01' AND new_value='2026-09-03' AND detail='Delivery moved' AND actor='33333333-3333-4333-8333-333333333333' AND is_demo) THEN RAISE EXCEPTION 'date history missing'; END IF;
 BEGIN
  PERFORM override_onboarding_task_date('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','2026-01-01','2026-09-03','Retry');
  RAISE EXCEPTION 'duplicate stale request allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This task changed%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM onboarding_project_events WHERE kind='task_date_overridden')<>1 THEN RAISE EXCEPTION 'duplicate date history'; END IF;
END $$;
ROLLBACK;
