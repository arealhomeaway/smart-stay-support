BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
INSERT INTO owner_time_entries(id,owner_user_id,review_status,minutes,activity,is_demo,attachment_path,materials_reviewed)
 VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','returned',90,'QA review',true,'qa/evidence','QA layout');
INSERT INTO owner_time_entry_properties VALUES('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
UPDATE owner_time_entries SET review_id='55555555-5555-4555-8555-555555555555',ticket_id='66666666-6666-4666-8666-666666666666',activity_category='review',decision_outcome='Selected layout',output='Approved layout',phase='onboarding',entry_date='2026-09-01' WHERE id='22222222-2222-4222-8222-222222222222';
-- The RPC must enforce ownership itself, including direct calls bypassing the server.
SELECT set_config('test.actor','44444444-4444-4444-8444-444444444444',true);
DO $$ BEGIN
 BEGIN
  PERFORM resubmit_owner_time_entry('22222222-2222-4222-8222-222222222222',45,'QA corrected review','Corrected duration');
  RAISE EXCEPTION 'different owner correction allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That entry is not available%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_time_entries) <> 1 THEN RAISE EXCEPTION 'unauthorized correction persisted'; END IF;
END $$;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
UPDATE owner_time_entries SET review_status=NULL WHERE id='22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
 BEGIN
  PERFORM resubmit_owner_time_entry('22222222-2222-4222-8222-222222222222',45,'QA corrected review','Corrected duration');
  RAISE EXCEPTION 'unknown review status allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only a returned entry%' THEN RAISE; END IF; END;
END $$;
UPDATE owner_time_entries SET review_status='returned' WHERE id='22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
 BEGIN
  PERFORM resubmit_owner_time_entry('22222222-2222-4222-8222-222222222222',0,'QA corrected review','Corrected duration');
  RAISE EXCEPTION 'zero minutes allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Enter actual minutes%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_time_entries) <> 1 THEN RAISE EXCEPTION 'invalid correction persisted'; END IF;
END $$;
ALTER TABLE owner_time_entry_properties ADD CONSTRAINT simulate_link_failure CHECK(entry_id='22222222-2222-4222-8222-222222222222');
DO $$ BEGIN
 BEGIN
  PERFORM resubmit_owner_time_entry('22222222-2222-4222-8222-222222222222',45,'QA corrected review','Corrected duration');
  RAISE EXCEPTION 'link failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT count(*) FROM owner_time_entries) <> 1 THEN RAISE EXCEPTION 'orphan correction persisted'; END IF;
END $$;
ALTER TABLE owner_time_entry_properties DROP CONSTRAINT simulate_link_failure;
SET LOCAL ROLE authenticated;
DO $$ DECLARE corrected uuid; BEGIN
 corrected := resubmit_owner_time_entry('22222222-2222-4222-8222-222222222222',45,'QA corrected review','Corrected duration');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entry_properties WHERE entry_id=corrected AND property_id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'historical property link lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=corrected AND minutes=45 AND is_demo AND attachment_path='qa/evidence' AND materials_reviewed='QA layout') THEN RAISE EXCEPTION 'correction context lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=corrected AND review_id='55555555-5555-4555-8555-555555555555' AND ticket_id='66666666-6666-4666-8666-666666666666' AND activity_category='review' AND decision_outcome='Selected layout' AND output='Approved layout' AND phase='onboarding' AND entry_date='2026-09-01') THEN RAISE EXCEPTION 'activity or opportunity linkage lost'; END IF;
 IF (SELECT minutes FROM owner_time_entries WHERE id='22222222-2222-4222-8222-222222222222') <> 90 THEN RAISE EXCEPTION 'original overwritten'; END IF;
 BEGIN
  PERFORM resubmit_owner_time_entry('22222222-2222-4222-8222-222222222222',60,'Another correction','Competing correction');
  RAISE EXCEPTION 'duplicate correction allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry has already%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
