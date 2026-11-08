CREATE OR REPLACE FUNCTION public.can_manage_playbooks(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT public.has_role(_user_id, 'admin') OR public.is_director(_user_id) OR public.is_onboarding_director(_user_id)
$function$
