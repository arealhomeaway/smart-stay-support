-- Undo onboarding-work-order-done. Keeps watch history rows and the two bookkeeping columns (nothing is deleted).
DROP FUNCTION IF EXISTS public.reopen_tasks_for_work_orders();
DROP FUNCTION IF EXISTS public.complete_task_on_work_order_created(uuid);
REVOKE SELECT ON public.onboarding_task_work_order_watch FROM authenticated;
INSERT INTO public.audit_log(actor_label, action, entity_type, reason)
VALUES ('Admin', 'onboarding_work_order_done.undo', 'migration', 'Undo onboarding-work-order-done');
