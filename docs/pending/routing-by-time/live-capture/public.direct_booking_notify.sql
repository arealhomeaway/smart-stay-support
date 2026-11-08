CREATE OR REPLACE FUNCTION public.direct_booking_notify(_users uuid[], _kind text, _title text, _body text, _lead uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, is_demo)
  SELECT DISTINCT u, _kind, _title, _body, 'lead', _lead, '/direct-bookings/' || _lead, 'high',
         coalesce((SELECT is_demo FROM public.leads WHERE id = _lead), false)
  FROM unnest(_users) u WHERE u IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$

