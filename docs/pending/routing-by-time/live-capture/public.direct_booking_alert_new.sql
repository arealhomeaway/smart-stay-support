CREATE OR REPLACE FUNCTION public.direct_booking_alert_new()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kind = 'direct_booking' AND NEW.owned_by IS NULL THEN
    PERFORM public.direct_booking_notify(
      ARRAY(SELECT public.direct_booking_on_shift(now())),
      'direct_booking_new',
      'New direct booking request',
      coalesce(NEW.partner_name, NEW.company, 'A partner') || ' is waiting. Press Start to own it and reply within 3 minutes.',
      NEW.id);
  END IF;
  RETURN NEW;
END $function$

