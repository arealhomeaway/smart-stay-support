-- Read only. Every row must read ok = true before apply.sql runs.
SELECT 'no part2 tables yet' AS check, NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('home_chats','home_chat_messages','home_chat_reads','home_chat_message_tasks','home_chat_alerts',
                     'property_owner_team_note_events','owner_weekly_updates','owner_weekly_update_settings',
                     'owner_weekly_update_events','owner_decision_reminders')) AS ok
UNION ALL SELECT 'no team_notes column', NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_owners' AND column_name='team_notes')
UNION ALL SELECT 'no onboarding_notes.kind', NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='onboarding_notes' AND column_name='kind')
UNION ALL SELECT 'realtime publication exists', EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
UNION ALL SELECT 'helpers present', to_regprocedure('private.is_program_member(uuid,uuid)') IS NOT NULL
  AND to_regprocedure('public.is_onboarding_director(uuid)') IS NOT NULL AND to_regprocedure('public.seat_holder(text)') IS NOT NULL
  AND to_regprocedure('private.ao_digest_time()') IS NOT NULL AND to_regprocedure('public.format_property_label(jsonb)') IS NOT NULL
UNION ALL SELECT 'daily owner email unchanged since capture',
  md5(pg_get_functiondef('public.ao_owner_email_run(timestamptz)'::regprocedure)) = '5d8495f7bf20b40be07d8a3949f04759';
-- md5 taken from the live database on Nov 13, 2026, when live-capture/ao_owner_email_run.sql was saved.
