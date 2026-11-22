-- onboarding-notify-escalate: preflight (read only). Every row must say ok = true before apply.
SELECT 'notice rules unchanged since staged (md5)' AS check,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.notify_onboarding_recipients(uuid[],uuid,text,text,text,text,uuid,text,boolean)'::regprocedure) = '734de847bab6f0878c0a8a15c4dfca3c'
  AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.notify_opportunity_staff(uuid,text)'::regprocedure) = '6bc5bffbb6a0c63bd0fdadb9d57fc99c'
  AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.owner_item_notify(public.owner_reviews,text,text)'::regprocedure) = 'e6d793c456760cfe395e4d604fb94fac'
  AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.owner_item_recipients(uuid)'::regprocedure) = 'f2fbc2ab8ec93172d896cc0eef57eb73' AS ok
UNION ALL SELECT 'only owner_item_notify uses owner_item_recipients',
  (SELECT count(*) FROM pg_proc WHERE prosrc ILIKE '%owner_item_recipients%' AND proname <> 'owner_item_recipients') = 1
UNION ALL SELECT 'Director of Onboarding role has a holder', EXISTS (SELECT 1 FROM public.functional_roles WHERE code IN ('onboarding_director','director_onboarding') AND active AND current_seat_holder IS NOT NULL)
UNION ALL SELECT 'no onboarding escalation columns, time zone, reminder table or test inbox yet',
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND ((table_name='escalations' AND column_name IN ('onboarding_task_id','work_item_id')) OR (table_name='profiles' AND column_name='time_zone')))
  AND to_regclass('public.onboarding_daily_reminders') IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'onboarding_email_test_inbox')
UNION ALL SELECT 'every escalation today has a ticket', NOT EXISTS (SELECT 1 FROM public.escalations WHERE ticket_id IS NULL)
UNION ALL SELECT 'no five-minute run in flight', NOT EXISTS (SELECT 1 FROM public.email_job_runs WHERE finished_at IS NULL);
