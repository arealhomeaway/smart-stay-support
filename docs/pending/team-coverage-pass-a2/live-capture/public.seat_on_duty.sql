CREATE OR REPLACE FUNCTION public.seat_on_duty(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.coverage_shifts c WHERE c.role_code = _role_code AND c.active)
      THEN true   -- seat is not schedule-gated (e.g. leadership / oversight by exception)
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
$function$;
