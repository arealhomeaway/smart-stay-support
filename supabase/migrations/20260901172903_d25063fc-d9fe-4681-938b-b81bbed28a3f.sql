REVOKE EXECUTE ON FUNCTION public.is_internal_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_internal_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_credentials(uuid) TO authenticated, service_role;