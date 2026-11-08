CREATE OR REPLACE FUNCTION public.functional_role_holders(_code text)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT current_seat_holder FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder IS NOT NULL
  UNION
  SELECT user_id FROM public.functional_role_members WHERE role_code = _code;
$function$

