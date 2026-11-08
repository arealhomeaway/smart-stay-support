-- Routing tweaks, part 2: overnight, a new Direct Booking also alerts the person on call.
-- Staged only. Not applied until approved. Needs routing-by-time/03_coordinator_routing.sql first.
-- Undo: 02_undo_direct_booking_on_call.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- Decision (Nov 8, 2026): overnight a Direct Booking request alerts the person on call as
-- well as the Operations Supervisor and the Director of Operations. Overnight is the saved
-- after hours window (coverage_config, today 10 p.m. to 8 a.m.); the person on call is
-- today's oncall_user_for_night (a dated roster entry wins over the weekday pattern), the
-- same night rule ticket routing uses. This is the same function as routing-by-time part 3
-- with the on call person added when no coordinator is working inside that window.
-- Coordinators on shift, lunch, the daytime Supervisor and Director fallback, the alert
-- trigger direct_booking_alert_new, its text, and who may press Start are unchanged.

CREATE OR REPLACE FUNCTION public.direct_booking_on_shift(_at timestamp with time zone DEFAULT now())
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH c AS (SELECT * FROM public.coordinators_on_shift(_at)),
  cfg AS (
    SELECT coalesce(cc.timezone, 'America/Chicago') AS tz,
           cc.after_hours_start_minute AS s, cc.after_hours_end_minute AS e
    FROM public.coverage_config cc WHERE cc.id LIMIT 1
  ),
  n AS (
    SELECT (_at AT TIME ZONE cfg.tz) AS loc, cfg.s, cfg.e,
           EXTRACT(hour FROM (_at AT TIME ZONE cfg.tz))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE cfg.tz))::int AS m
    FROM cfg
  ),
  o AS (
    SELECT public.oncall_user_for_night(CASE WHEN n.m < n.e THEN n.loc::date - 1 ELSE n.loc::date END) AS u
    FROM n
    WHERE n.s IS NOT NULL AND n.e IS NOT NULL
      AND CASE WHEN n.s > n.e THEN (n.m >= n.s OR n.m < n.e) ELSE (n.m >= n.s AND n.m < n.e) END
  ),
  k AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience' AND NOT c.at_lunch) THEN 1
      WHEN EXISTS (SELECT 1 FROM c WHERE NOT c.at_lunch) THEN 2
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience') THEN 3
      WHEN EXISTS (SELECT 1 FROM c) THEN 4
      ELSE 5
    END AS tier
  )
  SELECT c.user_id FROM c, k
   WHERE (k.tier = 1 AND c.team = 'guest_experience' AND NOT c.at_lunch)
      OR (k.tier = 2 AND NOT c.at_lunch)
      OR (k.tier = 3 AND c.team = 'guest_experience')
      OR k.tier = 4
  UNION
  SELECT h.u FROM k,
    (SELECT public.functional_role_holders('ops_supervisor') AS u
     UNION SELECT public.functional_role_holders('director_ops')) h
   WHERE k.tier = 5 AND h.u IS NOT NULL
  UNION
  SELECT o.u FROM k, o
   WHERE k.tier = 5 AND o.u IS NOT NULL AND public.staff_assignable(o.u)
$function$;
REVOKE ALL ON FUNCTION public.direct_booking_on_shift(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.direct_booking_on_shift(timestamp with time zone) TO service_role;
