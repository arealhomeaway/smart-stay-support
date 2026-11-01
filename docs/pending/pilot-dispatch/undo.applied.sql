-- Exact structural undo of new objects only. No existing function or ACL is changed.
-- Export any post-approval settings/history before undo. None exist at staging.
DROP TRIGGER guard_pilot_dispatch ON public.breezeway_outbound_tasks;
DROP TRIGGER finish_pilot_dispatch ON public.breezeway_outbound_tasks;
DROP TRIGGER guard_pilot_dispatch_close ON public.work_orders;
DROP FUNCTION public.guard_pilot_dispatch();
DROP FUNCTION public.guard_pilot_dispatch_close();
DROP FUNCTION public.finish_pilot_dispatch();
DROP FUNCTION public.pilot_dispatch_ready();
ALTER TABLE public.breezeway_outbound_tasks DROP COLUMN dispatch_guarded;
DROP FUNCTION public.save_breezeway_sending(text,uuid[]);
DROP TABLE public.breezeway_sending_history;
DROP TABLE public.breezeway_sending_settings;
