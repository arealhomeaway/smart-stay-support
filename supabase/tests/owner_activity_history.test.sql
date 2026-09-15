-- Isolated owner-role history policy mirrors the owner branch of the existing policy.
BEGIN;
GRANT SELECT,INSERT ON owner_program_events TO authenticated;
ALTER TABLE owner_program_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_history_read ON owner_program_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id AND p.owner_user_id=auth.uid()));
CREATE POLICY owner_history_append ON owner_program_events FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id AND p.owner_user_id=auth.uid()));
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
INSERT INTO owner_programs(id,owner_user_id,status,started_on,is_demo) VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','active',current_date-2,true);
INSERT INTO owner_reviews(id,program_id,property_id,status,available_from) VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','open',now()-interval '1 day');
INSERT INTO owner_program_properties VALUES('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','included',current_date-2);
INSERT INTO owner_time_entries(id,program_id,owner_user_id,phase,entry_date,minutes,activity,review_id,review_status,attested,is_demo)
VALUES('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','onboarding',current_date,10,'Old activity','33333333-3333-4333-8333-333333333333','returned',true,true);
INSERT INTO owner_time_entry_properties VALUES('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444');
ALTER TABLE owner_program_events ADD CONSTRAINT simulate_owner_history_failure CHECK(false);
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; BEGIN
 payload:=jsonb_build_object('programId','22222222-2222-4222-8222-222222222222','reviewId','33333333-3333-4333-8333-333333333333','phase','onboarding','entryDate',current_date,'minutes',30,'activity','Reviewed layout');
 BEGIN
  PERFORM log_owner_time_entry(payload,'{}');
  RAISE EXCEPTION 'logging ignored history failure';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  PERFORM resubmit_owner_time_entry('55555555-5555-4555-8555-555555555555',20,'Corrected activity','Reviewed original notes');
  RAISE EXCEPTION 'correction ignored history failure';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT count(*) FROM owner_time_entries)<>1 OR (SELECT count(*) FROM owner_time_entry_properties)<>1 OR EXISTS(SELECT 1 FROM owner_program_events) THEN RAISE EXCEPTION 'history failure left partial activity'; END IF;
END $$;
RESET ROLE;
ALTER TABLE owner_program_events DROP CONSTRAINT simulate_owner_history_failure;
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; logged uuid; corrected uuid; BEGIN
 payload:=jsonb_build_object('programId','22222222-2222-4222-8222-222222222222','reviewId','33333333-3333-4333-8333-333333333333','phase','onboarding','entryDate',current_date,'minutes',30,'activity','Reviewed layout','activityCategory','review');
 logged:=log_owner_time_entry(payload,'{}');
 corrected:=resubmit_owner_time_entry('55555555-5555-4555-8555-555555555555',20,'Corrected activity','Reviewed original notes');
 IF (SELECT count(*) FROM owner_program_events)<>2 THEN RAISE EXCEPTION 'missing or duplicated history'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE entry_id=logged AND actor_id=auth.uid() AND review_id='33333333-3333-4333-8333-333333333333' AND new_value='30' AND detail->>'phase'='onboarding' AND detail->>'category'='review' AND detail->'propertyIds'='["44444444-4444-4444-8444-444444444444"]'::jsonb) THEN RAISE EXCEPTION 'logging history context lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE entry_id=corrected AND actor_id=auth.uid() AND previous_value='10' AND new_value='20' AND reason='Reviewed original notes' AND detail->>'correctionOf'='55555555-5555-4555-8555-555555555555' AND detail->'propertyIds'='["44444444-4444-4444-8444-444444444444"]'::jsonb) THEN RAISE EXCEPTION 'correction history context lost'; END IF;
 BEGIN
  PERFORM resubmit_owner_time_entry('55555555-5555-4555-8555-555555555555',20,'Corrected activity','Retry original correction');
  RAISE EXCEPTION 'duplicate correction allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry has already%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_program_events)<>2 THEN RAISE EXCEPTION 'retry duplicated history'; END IF;
END $$;
SELECT set_config('test.actor','66666666-6666-4666-8666-666666666666',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM owner_program_events) THEN RAISE EXCEPTION 'history leaked to another owner'; END IF;
 BEGIN
  PERFORM resubmit_owner_time_entry('55555555-5555-4555-8555-555555555555',20,'Wrong owner correction','Cannot access');
  RAISE EXCEPTION 'wrong owner correction allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That entry is not available%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
ROLLBACK;
