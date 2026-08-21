-- Trigger-only functions: never callable directly by API roles
REVOKE ALL ON FUNCTION public.audit_role_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_owner_of_review() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_owner_of_ticket() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_identity_document_retention() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roll_quarterly_review() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_owner_time_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_vendor_rating() FROM PUBLIC, anon, authenticated;

-- Authorization helpers: signed-in only (needed by RLS policies and server functions)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.in_department(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_department(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_assigned_vendor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_vendor(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_onboarding_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_onboarding_staff(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_supervisor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_supervisor(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_vendor_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_vendor_admin(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_vendor_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_vendor_member(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.owner_sees_property(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_sees_property(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.owns_program(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_program(uuid, uuid) TO authenticated, service_role;