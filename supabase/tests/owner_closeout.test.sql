BEGIN;
-- Service role matches the real backend role only in this disposable fixture.
ALTER ROLE service_role BYPASSRLS;
GRANT SELECT,UPDATE ON owner_programs TO service_role;
GRANT INSERT ON owner_program_events TO service_role;
INSERT INTO owner_programs(id,owner_user_id,status,started_on) VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','active',current_date-2);
INSERT INTO properties(id,nickname) VALUES('44444444-4444-4444-8444-444444444444','Report home');
INSERT INTO owner_program_properties VALUES('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','included',current_date-2);
INSERT INTO owner_reviews(id,program_id,status) VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','answered');
INSERT INTO owner_time_entries(id,program_id,owner_user_id,minutes,activity) VALUES('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',6010,'Reviewed work');
DO $$ DECLARE before_version uuid; statement text; BEGIN
 IF has_function_privilege('authenticated','complete_owner_program(uuid,uuid,uuid,jsonb)','EXECUTE') OR has_function_privilege('authenticated','invalidate_owner_report_version()','EXECUTE') THEN RAISE EXCEPTION 'owner can invoke privileged closeout helpers'; END IF;
 -- Each relation used by the aggregate must invalidate an earlier read.
 FOREACH statement IN ARRAY ARRAY[
  'UPDATE owner_programs SET status=''target_reached''',
  'UPDATE owner_program_properties SET closing_date=current_date-1',
  'UPDATE owner_reviews SET status=''awaiting_owner''',
  'UPDATE owner_time_entries SET minutes=6000',
  'INSERT INTO owner_review_properties VALUES(''33333333-3333-4333-8333-333333333333'',''44444444-4444-4444-8444-444444444444'')',
  'INSERT INTO owner_time_entry_properties VALUES(''55555555-5555-4555-8555-555555555555'',''44444444-4444-4444-8444-444444444444'')',
  'INSERT INTO owner_badges(program_id,code) VALUES(''22222222-2222-4222-8222-222222222222'',''test'')',
  'UPDATE properties SET nickname=''Changed report name''',
  'DELETE FROM owner_review_properties',
  'DELETE FROM owner_time_entry_properties',
  'DELETE FROM owner_badges'
 ] LOOP
  SELECT report_version INTO before_version FROM owner_programs WHERE id='22222222-2222-4222-8222-222222222222';
  EXECUTE statement;
  BEGIN
   PERFORM complete_owner_program('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',before_version,'{}');
   RAISE EXCEPTION 'stale input accepted: %',statement;
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The program or its report inputs changed%' THEN RAISE; END IF; END;
 END LOOP;
END $$;
-- An owner can insert their entry, but cannot update the program under its RLS.
-- The trigger must still invalidate the supervisor's previously read version.
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
CREATE TEMP TABLE saved_version AS SELECT report_version FROM owner_programs;
SET LOCAL ROLE authenticated;
INSERT INTO owner_time_entries(program_id,owner_user_id,minutes,activity) VALUES('22222222-2222-4222-8222-222222222222',auth.uid(),20,'Concurrent owner activity');
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM owner_programs p JOIN saved_version s USING(report_version)) THEN RAISE EXCEPTION 'owner insert failed to invalidate closeout'; END IF;
END $$;
-- Completion and audit must roll back together on history failure.
ALTER TABLE owner_program_events ADD CONSTRAINT simulate_closeout_history_failure CHECK(false);
SET LOCAL ROLE service_role;
DO $$ DECLARE version uuid; BEGIN
 SELECT report_version INTO version FROM owner_programs WHERE id='22222222-2222-4222-8222-222222222222';
 BEGIN
  PERFORM complete_owner_program('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',version,'{}');
  RAISE EXCEPTION 'non-supervisor accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only a supervisor%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM complete_owner_program('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',version,'{"snapshot":"saved"}');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM owner_programs WHERE completed_at IS NOT NULL OR completion_report IS NOT NULL OR report_version<>version) THEN RAISE EXCEPTION 'partial closeout persisted'; END IF;
END $$;
RESET ROLE;
ALTER TABLE owner_program_events DROP CONSTRAINT simulate_closeout_history_failure;
SET LOCAL ROLE service_role;
DO $$ DECLARE version uuid; BEGIN
 SELECT report_version INTO version FROM owner_programs WHERE id='22222222-2222-4222-8222-222222222222';
 PERFORM complete_owner_program('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',version,'{"snapshot":"saved"}');
 IF NOT EXISTS(SELECT 1 FROM owner_programs WHERE status='completed' AND completed_at IS NOT NULL AND completed_by='99999999-9999-4999-8999-999999999999' AND completion_report='{"snapshot":"saved"}'::jsonb) THEN RAISE EXCEPTION 'closeout/report not saved'; END IF;
 BEGIN
  PERFORM complete_owner_program('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',version,'{}');
  RAISE EXCEPTION 'repeat closeout accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The program or its report inputs changed%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_program_events WHERE kind='program_completed')<>1 THEN RAISE EXCEPTION 'completion history missing or duplicated'; END IF;
END $$;
ROLLBACK;
