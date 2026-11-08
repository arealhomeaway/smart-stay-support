-- Fix batch 4, part 2: overnight Direct Booking leftovers (Emily, Nov 8, 2026; register D2, D3).
-- The morning alert said "reply within 3 minutes" at 8:00 AM. It now says "Reply clock starts at
-- 9:00 AM." (read from the Overnight reply clock starts at setting). Who is alerted, when, and
-- once only are unchanged. The internal note on leads.overnight_until is corrected in the same
-- step. Undo: 02_undo_*.sql.
CREATE OR REPLACE FUNCTION public.release_overnight_direct_bookings(_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record; _users uuid[]; _n integer := 0; _start text; _clock text;
BEGIN
  IF public.direct_booking_overnight_until(_at) IS NOT NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE kind = 'direct_booking' AND overnight_until <= _at
                   AND morning_alerted_at IS NULL AND owned_by IS NULL AND outcome IS NULL AND reply_sent_at IS NULL) THEN
    RETURN 0;
  END IF;
  _users := ARRAY(SELECT public.direct_booking_on_shift(_at));
  -- The Overnight reply clock starts at setting (register D3), default 9:00 AM.
  _start := (SELECT value->>'overnightClockStart' FROM public.app_settings WHERE key = 'direct_booking_settings');
  IF _start IS NULL OR _start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN _start := '09:00'; END IF;
  _clock := to_char(('2000-01-01 ' || _start)::timestamp, 'FMHH12:MI AM');
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
      coalesce(_r.partner_name, _r.company, 'A partner') || ' wrote overnight and is waiting. Press Start to own it. Reply clock starts at ' || _clock || '.',
      _r.id);
    UPDATE public.leads SET morning_alerted_at = _at WHERE id = _r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'release_overnight_direct_bookings: %', SQLERRM;
  RETURN 0;
END $function$;
COMMENT ON COLUMN public.leads.overnight_until IS 'Direct Bookings: set when a request arrives in the after hours window, to the moment the window ends. Waits in the Team Queue until then, when the morning alert goes. The reply clock starts at the Overnight reply clock starts at setting (default 9:00 AM).';
