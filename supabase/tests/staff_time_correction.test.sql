BEGIN;
INSERT INTO owner_time_entries(id,owner_user_id,review_status,minutes,activity,is_demo,attachment_path,materials_reviewed,activity_category,review_id,attested)
 VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','approved',90,'Reviewed layout',true,'qa/evidence','QA layout','review','33333333-3333-4333-8333-333333333333',true);
INSERT INTO owner_time_entry_properties VALUES('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444');
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.correct_owner_time_entry(uuid,uuid,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'owner can invoke staff correction'; END IF;
 BEGIN
  PERFORM correct_owner_time_entry('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',45,'Corrected duration');
  RAISE EXCEPTION 'non-supervisor correction allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only a supervisor%' THEN RAISE; END IF; END;
END $$;
ALTER TABLE owner_program_events ADD CONSTRAINT simulate_history_failure CHECK(false);
DO $$ BEGIN
 BEGIN
  PERFORM correct_owner_time_entry('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',45,'Corrected duration');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT count(*) FROM owner_time_entries)<>1 OR (SELECT count(*) FROM owner_time_entry_properties)<>1 THEN RAISE EXCEPTION 'partial correction persisted'; END IF;
END $$;
ALTER TABLE owner_program_events DROP CONSTRAINT simulate_history_failure;
DO $$ DECLARE corrected uuid; BEGIN
 corrected:=correct_owner_time_entry('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',45,'Corrected duration');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=corrected AND minutes=45 AND activity='Reviewed layout' AND activity_category='review' AND review_id='33333333-3333-4333-8333-333333333333' AND attachment_path='qa/evidence' AND materials_reviewed='QA layout' AND is_demo AND attested AND review_status='submitted') THEN RAISE EXCEPTION 'correction context lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_time_entry_properties WHERE entry_id=corrected AND property_id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'property link lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE entry_id=corrected AND previous_value='90' AND new_value='45' AND actor_id='99999999-9999-4999-8999-999999999999' AND reason='Corrected duration') THEN RAISE EXCEPTION 'history lost'; END IF;
 IF (SELECT minutes FROM owner_time_entries WHERE id='22222222-2222-4222-8222-222222222222')<>90 THEN RAISE EXCEPTION 'original changed'; END IF;
 BEGIN
  PERFORM correct_owner_time_entry('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',60,'Another correction');
  RAISE EXCEPTION 'duplicate correction allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry has already%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
