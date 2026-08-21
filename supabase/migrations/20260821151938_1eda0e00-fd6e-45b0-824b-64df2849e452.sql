REVOKE EXECUTE ON FUNCTION public.is_platform_owner(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_supervisor(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_onboarding_staff(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_onboarding_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.audit_role_change() FROM anon, authenticated, public;