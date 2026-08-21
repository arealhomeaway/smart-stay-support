CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = 'public', 'private';
ALTER FUNCTION public.in_department(uuid, text) SET search_path = 'public', 'private';
ALTER FUNCTION public.is_assigned_vendor(uuid, uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.is_onboarding_staff(uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.is_platform_owner(uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.is_staff(uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.is_supervisor(uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.is_vendor_admin(uuid, uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.is_vendor_member(uuid, uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.owner_sees_property(uuid, uuid) SET search_path = 'public', 'private';
ALTER FUNCTION public.owns_program(uuid, uuid) SET search_path = 'public', 'private';

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.in_department(uuid, text) SET SCHEMA private;
ALTER FUNCTION public.is_assigned_vendor(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_onboarding_staff(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_platform_owner(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_staff(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_supervisor(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_vendor_admin(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_vendor_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.owner_sees_property(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.owns_program(uuid, uuid) SET SCHEMA private;

-- Thin SECURITY INVOKER wrappers so the app can still ask "does this user hold this role?"
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = 'public', 'private'
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = 'public', 'private'
AS $$ SELECT private.is_staff(_user_id) $$;

CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = 'public', 'private'
AS $$ SELECT private.is_supervisor(_user_id) $$;

CREATE OR REPLACE FUNCTION public.is_onboarding_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = 'public', 'private'
AS $$ SELECT private.is_onboarding_staff(_user_id) $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_supervisor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_onboarding_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_onboarding_staff(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.in_department(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_assigned_vendor(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_onboarding_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_platform_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_supervisor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_vendor_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_vendor_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.owner_sees_property(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.owns_program(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;