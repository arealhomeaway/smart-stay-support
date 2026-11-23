CREATE OR REPLACE FUNCTION public.is_onboarding_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles
    WHERE code IN ('onboarding_director','director_onboarding') AND current_seat_holder = _user_id)
$function$;
