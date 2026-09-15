BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
INSERT INTO owner_programs VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','active',current_date-2,true);
INSERT INTO owner_reviews(id,program_id,property_id,status,available_from) VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','open',now()-interval '1 day');
INSERT INTO owner_program_properties VALUES('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','included',current_date-2);
INSERT INTO tickets VALUES('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555');
ALTER TABLE owner_time_entry_properties ADD CONSTRAINT simulate_new_link_failure CHECK(false);
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; BEGIN
 payload:=jsonb_build_object('programId','22222222-2222-4222-8222-222222222222','reviewId','33333333-3333-4333-8333-333333333333','phase','onboarding','entryDate',current_date,'minutes',30,'activity','Reviewed layout');
 BEGIN
  PERFORM log_owner_time_entry(payload,'{}');
  RAISE EXCEPTION 'link failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM owner_time_entries) THEN RAISE EXCEPTION 'partial time entry persisted'; END IF;
END $$;
RESET ROLE;
ALTER TABLE owner_time_entry_properties DROP CONSTRAINT simulate_new_link_failure;
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; new_id uuid; BEGIN
 payload:=jsonb_build_object('programId','22222222-2222-4222-8222-222222222222','reviewId','33333333-3333-4333-8333-333333333333','phase','onboarding','entryDate',current_date,'minutes',30,'activity','Reviewed layout','attachmentPath','qa/layout','activityCategory','review');
 BEGIN
  PERFORM log_owner_time_entry(payload || jsonb_build_object('ticketId','77777777-7777-4777-8777-777777777777'),'{}');
  RAISE EXCEPTION 'wrong-property ticket allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Choose a visible ticket%' THEN RAISE; END IF; END;
 new_id:=log_owner_time_entry(payload,'{}');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=new_id AND is_demo AND attachment_path='qa/layout' AND review_id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'entry context lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_time_entry_properties WHERE entry_id=new_id AND property_id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'default opportunity property lost'; END IF;
 BEGIN
  PERFORM log_owner_time_entry(payload,ARRAY['55555555-5555-4555-8555-555555555555'::uuid]);
  RAISE EXCEPTION 'wrong property allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That opportunity belongs%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM log_owner_time_entry(payload || jsonb_build_object('entryDate',current_date-3),'{}');
  RAISE EXCEPTION 'pre-start time allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Choose a date%' THEN RAISE; END IF; END;
 PERFORM set_config('test.actor','66666666-6666-4666-8666-666666666666',true);
 BEGIN
  PERFORM log_owner_time_entry(payload,'{}');
  RAISE EXCEPTION 'cross-owner time allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That participation program%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
UPDATE owner_reviews SET status='closed';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM log_owner_time_entry(jsonb_build_object('programId','22222222-2222-4222-8222-222222222222','reviewId','33333333-3333-4333-8333-333333333333','phase','onboarding','entryDate',current_date,'minutes',30,'activity','Reviewed layout'),'{}');
  RAISE EXCEPTION 'closed opportunity allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That opportunity is not available%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE owner_reviews SET status='open',available_from=now()+interval '1 day';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM log_owner_time_entry(jsonb_build_object('programId','22222222-2222-4222-8222-222222222222','reviewId','33333333-3333-4333-8333-333333333333','phase','onboarding','entryDate',current_date,'minutes',30,'activity','Reviewed layout'),'{}');
  RAISE EXCEPTION 'future opportunity allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That opportunity is not available%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM owner_time_entries)<>1 THEN RAISE EXCEPTION 'rejected requests created entries'; END IF;
END $$;
RESET ROLE;
UPDATE owner_reviews SET status='open',available_from=now()-interval '1 day',property_id='55555555-5555-4555-8555-555555555555',task_type='multi_property';
INSERT INTO owner_review_properties VALUES('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');
INSERT INTO owner_program_properties VALUES('22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555','included',current_date-2);
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; new_id uuid; BEGIN
 payload:=jsonb_build_object('programId','22222222-2222-4222-8222-222222222222','reviewId','33333333-3333-4333-8333-333333333333','phase','onboarding','entryDate',current_date,'minutes',30,'activity','Shared layout review');
 BEGIN
  PERFORM log_owner_time_entry(payload,ARRAY['55555555-5555-4555-8555-555555555555'::uuid]);
  RAISE EXCEPTION 'unassigned enrolled home allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That property is not assigned%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM log_owner_time_entry(payload,'{}');
  RAISE EXCEPTION 'multi-property activity unallocated';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Select the opportunity properties%' THEN RAISE; END IF; END;
 new_id:=log_owner_time_entry(payload,ARRAY['44444444-4444-4444-8444-444444444444'::uuid]);
 IF NOT EXISTS(SELECT 1 FROM owner_time_entry_properties WHERE entry_id=new_id AND property_id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'assigned home not linked'; END IF;
END $$;
ROLLBACK;
