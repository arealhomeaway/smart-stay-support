-- Undo for 02_guarded_actions.sql: restores today's five functions byte for byte from
-- live-capture/ (Nov 8, 2026) and removes the three added ones. No BEGIN/COMMIT.
-- Apply before 01_undo_request_fields.sql.

CREATE OR REPLACE FUNCTION public.request_direct_booking_approval(_lead_id uuid, _reply jsonb, _property_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _lead public.leads; _approval uuid;
BEGIN
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.owned_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who started this request can send the reply.'; END IF;
  IF _lead.reply_sent_at IS NOT NULL THEN RAISE EXCEPTION 'The reply was already sent.'; END IF;
  IF coalesce(array_length(_property_ids, 1), 0) > 3 THEN RAISE EXCEPTION 'Pick up to 3 homes.'; END IF;
  UPDATE public.leads SET reply_to = _reply->>'to', reply_subject = _reply->>'subject', reply_body = _reply->>'body',
         reply_cc = ARRAY(SELECT jsonb_array_elements_text(coalesce(_reply->'cc', '[]'::jsonb))),
         offered_property_ids = _property_ids, updated_at = now()
   WHERE id = _lead_id;
  IF NOT public.direct_booking_approval_required(now()) THEN
    RETURN jsonb_build_object('approval_required', false);
  END IF;
  INSERT INTO public.direct_booking_approvals(lead_id, requested_by, reply, property_ids)
  VALUES (_lead_id, auth.uid(), _reply, _property_ids)
  ON CONFLICT (lead_id) WHERE decision IS NULL DO UPDATE SET reply = EXCLUDED.reply, property_ids = EXCLUDED.property_ids
  RETURNING id INTO _approval;
  PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
    'direct_booking_approval', 'A direct booking reply needs your approval',
    'Check the homes and the reply. The clock is running.', _lead_id);
  RETURN jsonb_build_object('approval_required', true, 'approval_id', _approval);
END $function$
;

CREATE OR REPLACE FUNCTION public.decide_direct_booking_approval(_lead_id uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _a public.direct_booking_approvals; _as text; _wait int := coalesce((public.direct_booking_settings()->>'approvalWaitMinutes')::int, 2);
BEGIN
  IF _decision NOT IN ('approved','sent_back') THEN RAISE EXCEPTION 'Choose approve or send back.'; END IF;
  SELECT * INTO _a FROM public.direct_booking_approvals WHERE lead_id = _lead_id AND decision IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nothing is waiting for approval on this request.'; END IF;
  IF public.holds_functional_role(auth.uid(), 'ops_supervisor') THEN _as := 'ops_supervisor';
  ELSIF public.holds_functional_role(auth.uid(), 'director_ops')
        AND (_a.escalated_at IS NOT NULL OR _a.requested_at <= now() - make_interval(mins => _wait)) THEN _as := 'director_ops';
  ELSE RAISE EXCEPTION 'Only the Operations Supervisor can approve now. The Director of Operations can approve after % minutes.', _wait;
  END IF;
  IF _decision = 'sent_back' AND coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Say what to change.'; END IF;
  UPDATE public.direct_booking_approvals SET decision = _decision, decided_by = auth.uid(), decided_at = now(), decided_as = _as, note = _note
   WHERE id = _a.id;
  IF _decision = 'sent_back' THEN
    PERFORM public.direct_booking_notify(ARRAY[_a.requested_by], 'direct_booking_sent_back',
      'Your direct booking reply needs a change', coalesce(_note, ''), _lead_id);
  END IF;
  RETURN jsonb_build_object('approval_id', _a.id, 'decided_as', _as, 'reply', _a.reply);
END $function$
;

CREATE OR REPLACE FUNCTION public.record_direct_booking_reply(_lead_id uuid, _via text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _lead public.leads; _approved boolean; _sent timestamptz;
BEGIN
  IF _via NOT IN ('mailbox','manual') THEN RAISE EXCEPTION 'Unknown send method.'; END IF;
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.reply_sent_at IS NOT NULL THEN RETURN _lead.reply_sent_at; END IF;
  SELECT EXISTS (SELECT 1 FROM public.direct_booking_approvals WHERE lead_id = _lead_id AND decision = 'approved'
                  AND decided_at >= coalesce((SELECT max(requested_at) FROM public.direct_booking_approvals WHERE lead_id = _lead_id), '-infinity'))
    INTO _approved;
  IF NOT _approved THEN
    IF public.direct_booking_approval_required(now()) THEN RAISE EXCEPTION 'This reply needs approval before it sends.'; END IF;
    IF _lead.owned_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who started this request can send the reply.'; END IF;
  ELSIF NOT (_lead.owned_by = auth.uid() OR public.holds_functional_role(auth.uid(), 'ops_supervisor')
             OR public.holds_functional_role(auth.uid(), 'director_ops')) THEN
    RAISE EXCEPTION 'You cannot send this reply.';
  END IF;
  UPDATE public.leads SET reply_sent_at = now(), reply_sent_by = auth.uid(), reply_sent_via = _via,
         quote_sent_at = coalesce(quote_sent_at, now()), last_contact_at = now(), stage = 'engaged', updated_at = now()
   WHERE id = _lead_id RETURNING reply_sent_at INTO _sent;
  IF NOT _approved THEN
    -- After the approval period: the Operations Supervisor gets a copy.
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
      'direct_booking_sent_copy', 'A direct booking reply was sent', coalesce(_lead.reply_subject, ''), _lead_id);
  END IF;
  RETURN _sent;
END $function$
;

CREATE OR REPLACE FUNCTION public.record_direct_booking_follow_up(_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  UPDATE public.leads SET last_follow_up_at = now(), last_contact_at = now(), updated_at = now()
   WHERE id = _lead_id AND kind = 'direct_booking' AND reply_sent_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Send the first reply before a follow-up.'; END IF;
END $function$
;

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
;

DROP FUNCTION IF EXISTS public.mark_direct_booking_partner_approved(uuid, text);
DROP FUNCTION IF EXISTS public.direct_booking_cc_emails();
DROP FUNCTION IF EXISTS public.direct_booking_active_owner_homes(uuid[]);
