CREATE OR REPLACE FUNCTION public.direct_booking_on_shift(_at timestamp with time zone DEFAULT now())
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH t AS (
    SELECT extract(dow FROM _at AT TIME ZONE 'America/Chicago')::int AS wd,
           (extract(hour FROM _at AT TIME ZONE 'America/Chicago') * 60 + extract(minute FROM _at AT TIME ZONE 'America/Chicago'))::int AS m)
  SELECT DISTINCT fr.current_seat_holder
  FROM public.coverage_shifts cs
  JOIN public.functional_roles fr ON fr.code = cs.role_code AND fr.active AND fr.current_seat_holder IS NOT NULL
  CROSS JOIN t
  WHERE cs.active AND cs.weekday = t.wd AND t.m >= cs.start_minute AND t.m < cs.end_minute
    AND (t.wd IN (0, 6) OR cs.role_code IN ('ge_day', 'ge_evening'));
$function$

