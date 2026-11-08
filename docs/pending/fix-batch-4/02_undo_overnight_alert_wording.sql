-- Undo fix batch 4 part 2: restores the morning alert function and the column note as captured live on Nov 8, 2026.
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
COMMENT ON COLUMN public.leads.overnight_until IS 'Direct Bookings: set when a request arrives in the after hours window, to the moment the window ends. Waits in the Team Queue until then; the reply clock starts here.';
