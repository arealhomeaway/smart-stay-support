CREATE OR REPLACE FUNCTION private.ao_is_editor(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND (public.has_role(_uid,'admin') OR public.is_onboarding_director(_uid))
$function$
;

