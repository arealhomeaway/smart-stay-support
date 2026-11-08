-- lovable-cron-fallback-reviewed: no new schedule. The morning check rides on the existing 20 second Direct Booking job Emily approved (4,320 runs a day already), so the database wakes no more often than today.
-- Direct Bookings overnight (Emily, Nov 8, 2026). Replaces the overnight alert in register D2.
-- Undo: 01_undo_overnight_queue.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- The rule:
--  1. A new Direct Booking request that arrives inside the saved after hours window
--     (coverage_config, today 10 PM to 8 AM Central) alerts nobody: not the person on call,
--     not the Operations Supervisor, not the Director of Operations. The on call rule for new
--     tickets (auto_assign_ticket, coordinator_for) is not touched.
--  2. It is marked with the moment the window ends (leads.overnight_until) and waits, unowned,
--     at the top of the Team Queue as Right now for Team A (shown by the app from that mark).
--  3. When the window ends, the existing 20 second job alerts the people a new request would
--     alert at that moment under the normal rule (direct_booking_on_shift), once per request
--     (leads.morning_alerted_at). Needs you now then shows it to everyone eligible, as today,
--     and the first to press Start owns it.
--  4. Default (not a stated decision): the app starts the 3 minute clock at overnight_until.
--  5. Daytime is unchanged: same tiers, same lunch rule, Supervisor and Director when nobody works.
--
-- Changed: public.direct_booking_on_shift (overnight returns nobody; the on call branch is
-- removed, it only ever applied overnight). Added: two nullable columns on leads, three
-- functions, one BEFORE INSERT trigger on leads. The cron job keeps its name and 20 second
-- cadence and runs the unchanged escalate_direct_booking_approvals() first.
-- Unchanged: direct_booking_alert_new and its text, direct_booking_notify,
-- direct_booking_eligible_now, start_direct_booking, escalate_direct_booking_approvals, every
-- ticket routing function.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS overnight_until timestamptz,
  ADD COLUMN IF NOT EXISTS morning_alerted_at timestamptz;
COMMENT ON COLUMN public.leads.overnight_until IS 'Direct Bookings: set when a request arrives in the after hours window, to the moment the window ends. Waits in the Team Queue until then; the reply clock starts here.';
COMMENT ON COLUMN public.leads.morning_alerted_at IS 'Direct Bookings: when the morning alert for an overnight request was sent (once).';

-- When _at falls inside the saved after hours window: the moment that window ends. Else null.
CREATE OR REPLACE FUNCTION public.direct_booking_overnight_until(_at timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT coalesce(cc.timezone, 'America/Chicago') AS tz,
           cc.after_hours_start_minute AS s, cc.after_hours_end_minute AS e
    FROM public.coverage_config cc WHERE cc.id LIMIT 1
  ),
  n AS (
    SELECT (_at AT TIME ZONE cfg.tz) AS loc, cfg.tz, cfg.s, cfg.e,
           EXTRACT(hour FROM (_at AT TIME ZONE cfg.tz))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE cfg.tz))::int AS m
    FROM cfg
  )
  SELECT ((n.loc::date + CASE WHEN n.m < n.e THEN 0 ELSE 1 END) + make_interval(mins => n.e)) AT TIME ZONE n.tz
  FROM n
  WHERE n.s IS NOT NULL AND n.e IS NOT NULL
    AND CASE WHEN n.s > n.e THEN (n.m >= n.s OR n.m < n.e) ELSE (n.m >= n.s AND n.m < n.e) END
$function$;
REVOKE ALL ON FUNCTION public.direct_booking_overnight_until(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.direct_booking_overnight_until(timestamp with time zone) TO service_role;

-- Who a new Direct Booking request alerts at _at. Daytime: exactly as before. Overnight: nobody.
CREATE OR REPLACE FUNCTION public.direct_booking_on_shift(_at timestamp with time zone DEFAULT now())
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH c AS (SELECT * FROM public.coordinators_on_shift(_at)),
  d AS (SELECT public.direct_booking_overnight_until(_at) IS NULL AS daytime),
  k AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience' AND NOT c.at_lunch) THEN 1
      WHEN EXISTS (SELECT 1 FROM c WHERE NOT c.at_lunch) THEN 2
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience') THEN 3
      WHEN EXISTS (SELECT 1 FROM c) THEN 4
      ELSE 5
    END AS tier
  )
  SELECT c.user_id FROM c, k, d
   WHERE d.daytime
     AND ((k.tier = 1 AND c.team = 'guest_experience' AND NOT c.at_lunch)
      OR (k.tier = 2 AND NOT c.at_lunch)
      OR (k.tier = 3 AND c.team = 'guest_experience')
      OR k.tier = 4)
  UNION
  SELECT h.u FROM k, d,
    (SELECT public.functional_role_holders('ops_supervisor') AS u
     UNION SELECT public.functional_role_holders('director_ops')) h
   WHERE d.daytime AND k.tier = 5 AND h.u IS NOT NULL
$function$;
REVOKE ALL ON FUNCTION public.direct_booking_on_shift(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.direct_booking_on_shift(timestamp with time zone) TO service_role;

-- Marks a request that arrives overnight with the moment the window ends.
CREATE OR REPLACE FUNCTION public.direct_booking_hold_overnight()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kind = 'direct_booking' AND NEW.owned_by IS NULL THEN
    NEW.overnight_until := public.direct_booking_overnight_until(now());
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.direct_booking_hold_overnight() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS direct_booking_hold_overnight_trg ON public.leads;
CREATE TRIGGER direct_booking_hold_overnight_trg
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.direct_booking_hold_overnight();

-- Once the window has ended: alert, once, the people a new request would alert right now.
-- Never raises, so the Director's approval check in the same job always runs.
CREATE OR REPLACE FUNCTION public.release_overnight_direct_bookings(_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record; _users uuid[]; _n integer := 0;
BEGIN
  IF public.direct_booking_overnight_until(_at) IS NOT NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE kind = 'direct_booking' AND overnight_until <= _at
                   AND morning_alerted_at IS NULL AND owned_by IS NULL AND outcome IS NULL AND reply_sent_at IS NULL) THEN
    RETURN 0;
  END IF;
  _users := ARRAY(SELECT public.direct_booking_on_shift(_at));
  FOR _r IN
    SELECT id, partner_name, company FROM public.leads
     WHERE kind = 'direct_booking' AND overnight_until <= _at AND morning_alerted_at IS NULL
       AND owned_by IS NULL AND outcome IS NULL AND reply_sent_at IS NULL
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.direct_booking_notify(
      _users,
      'direct_booking_new',
      'New direct booking request',
      coalesce(_r.partner_name, _r.company, 'A partner') || ' wrote overnight and is waiting. Press Start to own it and reply within 3 minutes.',
      _r.id);
    UPDATE public.leads SET morning_alerted_at = _at WHERE id = _r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'release_overnight_direct_bookings: %', SQLERRM;
  RETURN 0;
END $function$;
REVOKE ALL ON FUNCTION public.release_overnight_direct_bookings(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_overnight_direct_bookings(timestamp with time zone) TO service_role;

-- Same job name and cadence; the Director's approval check runs first, unchanged.
SELECT cron.schedule(
  'direct-booking-approval-escalation',
  '20 seconds',
  'SELECT public.escalate_direct_booking_approvals(); SELECT public.release_overnight_direct_bookings();'
);
