CREATE OR REPLACE FUNCTION public.record_direct_booking_follow_up(_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  UPDATE public.leads SET last_follow_up_at = now(), last_contact_at = now(), updated_at = now(),
         follow_up_due_at = now() + interval '48 hours'
   WHERE id = _lead_id AND kind = 'direct_booking' AND reply_sent_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Send the first reply before a follow-up.'; END IF;
END $function$
