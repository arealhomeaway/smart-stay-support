CREATE OR REPLACE FUNCTION public.seat_override_at(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS TABLE(kind text, user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.kind, o.user_id
  FROM public.coverage_overrides o
  WHERE o.role_code = _role_code AND _at >= o.starts_at AND _at < o.ends_at
  ORDER BY o.created_at DESC
  LIMIT 1
$function$

