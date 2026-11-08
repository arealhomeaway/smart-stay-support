CREATE OR REPLACE FUNCTION public.seat_holder_at(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT o.user_id FROM public.seat_override_at(_role_code, _at) o WHERE o.kind = 'cover'),
    (SELECT r.current_seat_holder FROM public.functional_roles r WHERE r.code = _role_code)
  )
$function$

