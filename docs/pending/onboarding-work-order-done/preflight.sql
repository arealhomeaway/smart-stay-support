-- Read only. Every ok must be true.
SELECT 'mark-done-breezeway applied (hold gone)' AS check,
       position('already sent for it' in pg_get_functiondef('public.bulk_complete_onboarding_tasks'::regproc)) = 0 AS ok
UNION ALL SELECT 'no watch table yet', to_regclass('public.onboarding_task_work_order_watch') IS NULL
UNION ALL SELECT 'no new functions yet', NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('complete_task_on_work_order_created','reopen_tasks_for_work_orders'))
UNION ALL SELECT 'no instructions columns yet', NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='breezeway_outbound_tasks' AND column_name IN ('instructions_set_at','instructions_error'))
UNION ALL SELECT 'audit action unused', NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action LIKE 'onboarding_work_order_done.%');
