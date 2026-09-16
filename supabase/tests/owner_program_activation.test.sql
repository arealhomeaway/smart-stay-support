BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false),
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',false),
 ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo,dfy_confirmed)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','draft',false,true);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included',current_date-5,true),
 ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','included',current_date-2,true);
CREATE FUNCTION expect_activation_rejected(_version uuid,_day date,_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  PERFORM activate_owner_program('55555555-5555-4555-8555-555555555555',_version,_day);
  RAISE EXCEPTION 'invalid activation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE _message THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555' AND started_on IS NOT NULL) THEN RAISE EXCEPTION 'rejected activation changed clock'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(NULL,current_date,'The program or its properties changed%');
SELECT expect_activation_rejected('00000000-0000-4000-8000-000000000000',current_date,'The program or its properties changed%');
SELECT expect_activation_rejected(report_version,NULL,'Choose a valid start date%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
SELECT expect_activation_rejected(report_version,current_date+1,'Choose a valid start date%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
SELECT expect_activation_rejected(report_version,'infinity','Choose a valid start date%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
SELECT expect_activation_rejected(report_version,current_date-3,'The program start must be on or after every included property%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
DO $$ BEGIN
 BEGIN
  UPDATE owner_programs SET started_on=current_date,ends_on=current_date+89,status='active' WHERE id='55555555-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'direct clock activation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Start the program through the atomic activation action.' THEN RAISE; END IF; END;
 BEGIN
  UPDATE owner_programs SET status='active' WHERE id='55555555-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'direct status activation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Start the program through the atomic activation action.' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','activate_owner_program(uuid,uuid,date)','EXECUTE') THEN RAISE EXCEPTION 'anonymous activation grant'; END IF;
END $$;
RESET ROLE;

-- Explicit authorization is independent of raw table visibility or ownership.
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'Only a supervisor%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
SELECT set_config('test.actor','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
SELECT set_config('test.staff','true',true);
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected('00000000-0000-4000-8000-000000000000',current_date,'Only a supervisor%');
RESET ROLE;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);

UPDATE owner_programs SET dfy_confirmed=false WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'Confirm with DFY%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
UPDATE owner_programs SET dfy_confirmed=true,archived_at=now() WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'This program cannot be activated%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
UPDATE owner_programs SET archived_at=NULL,status='paused' WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'This program cannot be activated%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
UPDATE owner_programs SET status='draft' WHERE id='55555555-5555-4555-8555-555555555555';
UPDATE property_owners SET active=false WHERE id='11111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'Activation requires an active canonical Owner.') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
UPDATE property_owners SET active=true WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE properties SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'Every included Property must reference%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
UPDATE properties SET owner_record_id='11111111-1111-4111-8111-111111111111',is_demo=true WHERE id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'Every included Property must reference%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
UPDATE properties SET is_demo=false,archived_at=now() WHERE id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE authenticated;
SELECT expect_activation_rejected(report_version,current_date,'Every included Property must reference%') FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
RESET ROLE;
UPDATE properties SET archived_at=NULL WHERE id='44444444-4444-4444-8444-444444444444';

-- Changed confirmations and removals invalidate the version seen by staff.
SET LOCAL ROLE authenticated;
DO $$ DECLARE seen uuid; BEGIN
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 UPDATE owner_program_properties SET closing_confirmed=false WHERE property_id='44444444-4444-4444-8444-444444444444';
 PERFORM expect_activation_rejected(seen,current_date,'The program or its properties changed%');
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 PERFORM expect_activation_rejected(seen,current_date,'The program start must be on or after every included property%');
 UPDATE owner_program_properties SET closing_confirmed=true,closing_date=NULL WHERE property_id='44444444-4444-4444-8444-444444444444';
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 PERFORM expect_activation_rejected(seen,current_date,'The program start must be on or after every included property%');
 UPDATE owner_program_properties SET closing_date=current_date-2 WHERE property_id='44444444-4444-4444-8444-444444444444';
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 UPDATE owner_program_properties SET inclusion_status='removed' WHERE program_id='55555555-5555-4555-8555-555555555555';
 PERFORM expect_activation_rejected(seen,current_date,'The program or its properties changed%');
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 PERFORM expect_activation_rejected(seen,current_date,'Add at least one included Property%');
 UPDATE owner_program_properties SET inclusion_status='included' WHERE program_id='55555555-5555-4555-8555-555555555555';
 BEGIN
  UPDATE owner_program_properties SET is_demo=true WHERE property_id='44444444-4444-4444-8444-444444444444';
  RAISE EXCEPTION 'mixed enrollment demo accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Enrollment requires a current Property%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

CREATE FUNCTION fail_program_activation_history() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.kind='program_activated' THEN RAISE EXCEPTION 'forced activation history failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fail_program_activation_history BEFORE INSERT ON owner_program_events FOR EACH ROW EXECUTE FUNCTION fail_program_activation_history();
SET LOCAL ROLE authenticated;
DO $$ DECLARE seen uuid; BEGIN
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 PERFORM expect_activation_rejected(seen,current_date-1,'forced activation history failure');
 IF NOT EXISTS(SELECT 1 FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555' AND report_version=seen AND ends_on IS NULL AND activated_at IS NULL) THEN
  RAISE EXCEPTION 'failed history changed activation fields/version';
 END IF;
END $$;
RESET ROLE;
DROP TRIGGER fail_program_activation_history ON owner_program_events;

SET LOCAL ROLE authenticated;
DO $$ DECLARE seen uuid; saved uuid; BEGIN
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 saved:=activate_owner_program('55555555-5555-4555-8555-555555555555',seen,current_date-1);
 IF saved IS DISTINCT FROM '55555555-5555-4555-8555-555555555555'::uuid OR NOT EXISTS(SELECT 1 FROM owner_programs WHERE id=saved
  AND status='active' AND started_on=current_date-1 AND ends_on=current_date+88 AND activated_by=auth.uid() AND activated_at IS NOT NULL
  AND target_hours=100 AND operating_target_hours=105) THEN RAISE EXCEPTION 'activation clock/targets/provenance incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE program_id=saved AND kind='program_activated' AND actor_id=auth.uid()
  AND jsonb_array_length(detail->'closings')=2 AND detail->>'ownerId'='11111111-1111-4111-8111-111111111111' AND detail->>'reviewedVersion'=seen::text) THEN
  RAISE EXCEPTION 'activation history does not retain current enrollment evidence';
 END IF;
 BEGIN
  PERFORM activate_owner_program(saved,seen,current_date);
  RAISE EXCEPTION 'competing activation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The program or its properties changed%' THEN RAISE; END IF; END;
 SELECT report_version INTO seen FROM owner_programs WHERE id=saved;
 BEGIN
  PERFORM activate_owner_program(saved,seen,current_date);
  RAISE EXCEPTION 'clock restarted with refreshed version';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This program cannot be activated%' THEN RAISE; END IF; END;
 BEGIN
  UPDATE owner_programs SET started_on=current_date,ends_on=current_date+89 WHERE id=saved;
  RAISE EXCEPTION 'raw clock reset accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'The activated program clock and its activation record cannot be reset.' THEN RAISE; END IF; END;
 UPDATE owner_programs SET status='paused' WHERE id=saved;
 UPDATE owner_programs SET status='active' WHERE id=saved;
 IF NOT EXISTS(SELECT 1 FROM owner_programs WHERE id=saved AND started_on=current_date-1 AND ends_on=current_date+88) THEN RAISE EXCEPTION 'pause/resume changed clock'; END IF;
 BEGIN
  INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed)
   VALUES(saved,'66666666-6666-4666-8666-666666666666','included',current_date,true);
  RAISE EXCEPTION 'non-admin stale preactivation enrollment accepted after activation';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Adding a property to a program already underway%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

SELECT set_config('test.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed)
   VALUES('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','included',current_date+1,true);
  RAISE EXCEPTION 'future closing accepted after activation';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Confirm the property%closing date before adding%' THEN RAISE; END IF; END;
 INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed)
  VALUES('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','included',current_date,true);
 IF NOT EXISTS(SELECT 1 FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555' AND started_on=current_date-1 AND ends_on=current_date+88 AND target_hours=100) THEN
  RAISE EXCEPTION 'late enrollment changed combined clock or target';
 END IF;
END $$;
RESET ROLE;
-- Demo activation stays isolated and requires the existing administrator role.
INSERT INTO properties(id,owner_record_id,is_demo)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222',true);
INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo,dfy_confirmed)
 VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','draft',true,true);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed,is_demo)
 VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','included',current_date-1,true,true);
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE seen uuid; BEGIN
 SELECT report_version INTO seen FROM owner_programs WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 BEGIN
  PERFORM activate_owner_program('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',seen,current_date);
  RAISE EXCEPTION 'manager activated demo program';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Only an administrator can activate a demo owner program.' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM owner_programs WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND started_on IS NOT NULL) THEN
  RAISE EXCEPTION 'denied demo activation started clock';
 END IF;
END $$;
RESET ROLE;
SELECT set_config('test.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SET LOCAL ROLE authenticated;
SELECT activate_owner_program(id,report_version,current_date) FROM owner_programs WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM owner_programs WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND is_demo AND status='active' AND started_on=current_date AND ends_on=current_date+89) THEN
  RAISE EXCEPTION 'administrator demo activation failed';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
