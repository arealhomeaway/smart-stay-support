REVOKE EXECUTE ON FUNCTION public.owner_sees_property(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_owner_of_ticket() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_owner_of_review() FROM anon, authenticated;