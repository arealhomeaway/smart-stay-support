-- Only alongside undo after an authorized future drop. Not applied.
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO PUBLIC, postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_operations(uuid) TO PUBLIC, postgres, anon, authenticated, service_role;