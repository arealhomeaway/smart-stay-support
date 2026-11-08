CREATE OR REPLACE FUNCTION public.mark_direct_booking_outcome(_lead_id uuid, _outcome text, _property_id uuid DEFAULT NULL::uuid, _move_in date DEFAULT NULL::date, _reason text DEFAULT NULL::text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _lead public.leads;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.reply_sent_at IS NULL THEN RAISE EXCEPTION 'Send the reply first.'; END IF;
  IF _outcome = 'booked' THEN
    IF _property_id IS NOT NULL AND NOT (_property_id = ANY(coalesce(_lead.offered_property_ids, '{}'))) THEN
      RAISE EXCEPTION 'Choose one of the offered homes.'; END IF;
    UPDATE public.leads SET outcome = 'booked', outcome_at = now(), outcome_by = auth.uid(),
           booked_property_id = _property_id, booked_move_in = _move_in, stage = 'converted',
           converted_at = now(), converted_by = auth.uid(), converted_property_id = _property_id, updated_at = now()
     WHERE id = _lead_id;
  ELSIF _outcome = 'not_booked' THEN
    IF coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Add a short note.'; END IF;
    UPDATE public.leads SET outcome = 'not_booked', outcome_at = now(), outcome_by = auth.uid(),
           not_booked_reason = _reason, not_booked_note = left(_note, 500), stage = 'lost', lost_at = now(),
           lost_note = left(_note, 500), updated_at = now()
     WHERE id = _lead_id;
  ELSE RAISE EXCEPTION 'Choose booked or not booked.';
  END IF;
END $function$

