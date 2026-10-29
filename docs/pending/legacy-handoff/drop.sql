-- Pending only. No CASCADE; dependency failure must stop retirement.
DROP FUNCTION public.mark_ready_for_operations(uuid);
DROP FUNCTION public.accept_into_operations(uuid);