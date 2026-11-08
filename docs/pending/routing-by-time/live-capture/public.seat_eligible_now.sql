CREATE OR REPLACE FUNCTION public.seat_eligible_now(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'off' THEN false
    WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'cover' THEN true
    WHEN NOT COALESCE((SELECT r.available FROM public.functional_roles r WHERE r.code = _role_code), true) THEN false
    ELSE public.seat_on_duty(_role_code, _at)
  END
$function$

