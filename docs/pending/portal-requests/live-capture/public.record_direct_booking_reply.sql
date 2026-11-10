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
         quote_sent_at = coalesce(quote_sent_at, now()), last_contact_at = now(), stage = 'engaged', updated_at = now(),
         follow_up_due_at = now() + interval '48 hours'
   WHERE id = _lead_id RETURNING reply_sent_at INTO _sent;
  IF NOT _approved THEN
    -- After the approval period: the Operations Supervisor gets a copy.
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
      'direct_booking_sent_copy', 'A direct booking reply was sent', coalesce(_lead.reply_subject, ''), _lead_id);
  END IF;
  RETURN _sent;
END $function$
