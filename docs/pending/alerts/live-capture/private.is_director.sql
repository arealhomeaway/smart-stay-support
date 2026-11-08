CREATE OR REPLACE FUNCTION private.is_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- A Platform Owner may always act with full authority. Otherwise, only
  -- whoever currently holds (or is covering) the director_ops seat.
  SELECT public.has_role(_user_id, 'admin')
    OR public.seat_holder_at('director_ops') = _user_id
$function$

