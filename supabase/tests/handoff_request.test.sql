BEGIN;
SELECT set_config('test.staff','true',true);
INSERT INTO properties(id,lifecycle_status,is_demo) VALUES('11111111-1111-4111-8111-111111111111','onboarding',true);
SELECT set_config('test.staff','false',true);
DO $$ BEGIN
 BEGIN
  PERFORM create_onboarding_handoff('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":[]}');
  RAISE EXCEPTION 'non-staff request accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only onboarding staff%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('test.staff','true',true);
DO $$ BEGIN
 BEGIN
  PERFORM create_onboarding_handoff('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":["33333333-3333-4333-8333-333333333333"],"carryoverAccepted":false}');
  RAISE EXCEPTION 'unaccepted carryover allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Open handoff items require%' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM property_handoffs) THEN RAISE EXCEPTION 'rejected request persisted'; END IF;
END $$;
INSERT INTO onboarding_tasks(id,property_id,status,assigned_to,due_on,carryover_reason)
 VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','open',NULL,current_date,'QA carryover');
DO $$ BEGIN
 BEGIN
  PERFORM create_onboarding_handoff('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":["33333333-3333-4333-8333-333333333333"],"carryoverAccepted":true}');
  RAISE EXCEPTION 'unassigned carryover allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Carryover changed%' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM property_handoffs) THEN RAISE EXCEPTION 'invalid carryover persisted'; END IF;
END $$;
ALTER TABLE properties ADD CONSTRAINT simulate_lifecycle_failure CHECK(lifecycle_status<>'handoff_requested');
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.create_onboarding_handoff(uuid,uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'client can bypass readiness handler'; END IF;
 BEGIN
  PERFORM create_onboarding_handoff('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":[],"carryoverAccepted":false,"validation":{"ready":true},"checklist":[]}');
  RAISE EXCEPTION 'lifecycle failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM property_handoffs) THEN RAISE EXCEPTION 'partial handoff persisted'; END IF;
END $$;
ALTER TABLE properties DROP CONSTRAINT simulate_lifecycle_failure;
DO $$ DECLARE request_id uuid; BEGIN
 request_id:=create_onboarding_handoff('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":[],"carryoverAccepted":false,"validation":{"ready":true},"checklist":[]}');
 IF NOT EXISTS(SELECT 1 FROM property_handoffs WHERE id=request_id AND is_demo AND gate_step='kati_review' AND status='requested' AND requested_by='22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'handoff context lost'; END IF;
 IF (SELECT lifecycle_status FROM properties WHERE id='11111111-1111-4111-8111-111111111111')<>'handoff_requested' THEN RAISE EXCEPTION 'lifecycle not advanced'; END IF;
 BEGIN
  PERFORM create_onboarding_handoff('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":[]}');
  RAISE EXCEPTION 'stale request accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The property changed%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM property_handoffs)<>1 THEN RAISE EXCEPTION 'duplicate handoff created'; END IF;
END $$;
UPDATE properties SET lifecycle_status='onboarding' WHERE id='11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
 BEGIN
  PERFORM create_onboarding_handoff('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":[]}');
  RAISE EXCEPTION 'duplicate with inconsistent lifecycle allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'A handoff is already%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM property_handoffs)<>1 THEN RAISE EXCEPTION 'duplicate persisted'; END IF;
END $$;
INSERT INTO properties(id,lifecycle_status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','onboarding',true);
UPDATE onboarding_tasks SET assigned_to='22222222-2222-4222-8222-222222222222' WHERE id='33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
 BEGIN
  PERFORM create_onboarding_handoff('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":["33333333-3333-4333-8333-333333333333"],"carryoverAccepted":true}');
  RAISE EXCEPTION 'cross-property carryover allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Carryover changed%' THEN RAISE; END IF; END;
END $$;
UPDATE onboarding_tasks SET property_id='55555555-5555-4555-8555-555555555555' WHERE id='33333333-3333-4333-8333-333333333333';
DO $$ DECLARE request_id uuid; BEGIN
 request_id:=create_onboarding_handoff('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','onboarding','{"openTaskIds":["33333333-3333-4333-8333-333333333333"],"carryoverAccepted":true}');
 IF NOT EXISTS(SELECT 1 FROM property_handoffs WHERE id=request_id AND carryover_accepted AND open_task_ids=ARRAY['33333333-3333-4333-8333-333333333333'::uuid]) THEN RAISE EXCEPTION 'valid carryover lost'; END IF;
END $$;
ROLLBACK;
