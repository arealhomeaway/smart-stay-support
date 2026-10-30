CREATE OR REPLACE FUNCTION private.can_assign_onboarding_responsibility(_actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT _actor IS NOT NULL AND private.onboarding_assignment_staff(_actor)
 AND (coalesce(public.has_role(_actor,'admin'),false) OR _actor=private.current_onboarding_director())
$function$
