CREATE OR REPLACE FUNCTION public.seat_on_duty(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.coverage_shifts c WHERE c.role_code = _role_code AND c.active)
      THEN NOT (_role_code LIKE 'ge\_%' OR _role_code LIKE 'po\_%')
      -- only scheduled coverage seats (ge_*, po_*) with no recurring shifts are off duty (Pass A.2);
      -- every other seat keeps the previous rule: no shifts means always on duty
    ELSE EXISTS (
      SELECT 1 FROM public.coverage_shifts c
      WHERE c.role_code = _role_code AND c.active
        AND c.weekday = EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int
        AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int)
            >= c.start_minute
        AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int)
            < c.end_minute
    )
  END
$function$

