CREATE OR REPLACE FUNCTION private.onboarding_assignment_staff(_actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT coalesce(public.is_onboarding_staff(_actor),false) AND EXISTS(
  SELECT 1 FROM auth.users u WHERE u.id=_actor AND u.deleted_at IS NULL
   AND (u.banned_until IS NULL OR u.banned_until<=now()))
$function$
