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

