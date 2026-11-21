-- active-owner-pace-hold: preflight (read only). Every row must say ok = true before apply.
SELECT 'the column does not exist yet' AS check,
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'owner_programs'
              AND column_name = 'pace_emails_held_until') AS ok
UNION ALL SELECT 'the rule does not exist yet',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'private' AND p.proname = 'hold_pace_after_correction')
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.owner_time_entries'::regclass AND tgname = 'owner_time_correction_pace_hold')
UNION ALL SELECT 'hour entry triggers are the four known ones, all on',
  (SELECT string_agg(tgname || ':' || tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger
    WHERE tgrelid = 'public.owner_time_entries'::regclass AND NOT tgisinternal)
  = 'capture_owner_time_update:O,owner_entry_report_version:O,owner_time_entries_validate:O,owner_time_write_guard:O'
UNION ALL SELECT 'program records are changed as the trusted owner (postgres)',
  (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid = 'public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure) = 'postgres'
UNION ALL SELECT 'the team correction action is unchanged (md5 of body)',
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.correct_owner_time_entry(uuid,uuid,integer,text)'::regprocedure) = 'b5ef1871dcd5d40f6b6b0193335cc2fc';
