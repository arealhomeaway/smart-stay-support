REVOKE EXECUTE ON FUNCTION public.notify_ticket_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_handoff_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_approval_events() FROM PUBLIC, anon, authenticated;