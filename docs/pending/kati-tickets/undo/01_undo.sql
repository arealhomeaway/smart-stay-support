-- Undo for 01_kati_tickets.sql. Removes only what that file added. Links and history saved by
-- the Breezeway section are removed with their tables; export them first if any were recorded.
DELETE FROM public.feature_flags WHERE key = 'onboarding_breezeway_send';
DROP FUNCTION IF EXISTS public.save_onboarding_task_breezeway(uuid, date, text, bigint, text);
DROP TRIGGER IF EXISTS block_onboarding_breezeway_event_change ON public.onboarding_task_breezeway_events;
DROP FUNCTION IF EXISTS private.block_onboarding_breezeway_event_change();
DROP TABLE IF EXISTS public.onboarding_task_breezeway_events;
DROP TABLE IF EXISTS public.onboarding_task_breezeway_links;
DROP FUNCTION IF EXISTS public.bulk_complete_onboarding_tasks(uuid, uuid[], text, date, uuid, boolean);
DROP FUNCTION IF EXISTS private.write_onboarding_bulk_completion(uuid, jsonb, uuid);
-- Completed tasks, their audit_log rows and file links written by bulk completion are kept:
-- they are the record of real work. Reopen a task with a reason to undo a completion.
