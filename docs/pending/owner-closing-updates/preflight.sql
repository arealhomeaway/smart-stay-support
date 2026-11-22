-- owner-closing-updates preflight (read only). Every row must say ok = true before apply.
SELECT 'update record not there yet' AS check, to_regclass('public.owner_closing_updates') IS NULL AS ok
UNION ALL SELECT 'history record not there yet', to_regclass('public.owner_closing_update_events') IS NULL
UNION ALL SELECT 'Edit and Hold actions not there yet', NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('edit_owner_closing_update', 'hold_owner_closing_update'))
UNION ALL SELECT 'test inbox setting not there yet', NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'owner_update_test_inbox')
UNION ALL SELECT 'helpers it uses exist', to_regprocedure('private.is_staff(uuid)') IS NOT NULL
  AND to_regprocedure('public.is_onboarding_director(uuid)') IS NOT NULL AND to_regprocedure('private.has_role(uuid,app_role)') IS NOT NULL
UNION ALL SELECT 'tables it reads exist', to_regclass('public.onboarding_projects') IS NOT NULL AND to_regclass('public.properties') IS NOT NULL
UNION ALL SELECT 'not applied before', NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action LIKE 'owner_closing_updates.%');
