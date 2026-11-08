-- Undo for 01_overnight_queue.sql. Restores the live copies read Nov 8, 2026 (live-capture/).
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
-- The two added columns on leads stay (nullable, nothing reads them after this undo) so no
-- saved request loses data; they are marked as no longer used.

SELECT cron.schedule(
  'direct-booking-approval-escalation',
  '20 seconds',
  $$SELECT public.escalate_direct_booking_approvals()$$
);

DROP TRIGGER IF EXISTS direct_booking_hold_overnight_trg ON public.leads;
DROP FUNCTION IF EXISTS public.direct_booking_hold_overnight();
DROP FUNCTION IF EXISTS public.release_overnight_direct_bookings(timestamp with time zone);

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

DROP FUNCTION IF EXISTS public.direct_booking_overnight_until(timestamp with time zone);

COMMENT ON COLUMN public.leads.overnight_until IS 'DEPRECATED: overnight Direct Booking hold was undone; not read.';
COMMENT ON COLUMN public.leads.morning_alerted_at IS 'DEPRECATED: overnight Direct Booking hold was undone; not read.';
