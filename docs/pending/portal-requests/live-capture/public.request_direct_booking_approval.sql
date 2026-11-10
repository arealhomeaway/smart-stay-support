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
  IF EXISTS (SELECT 1 FROM public.direct_booking_active_owner_homes(_property_ids)) THEN
    RAISE EXCEPTION 'A home you picked is in the Active Owner program and cannot be offered. Remove it and pick another home.';
  END IF;
  -- The copy always goes to the two roles and nobody else.
  _reply := jsonb_set(coalesce(_reply, '{}'::jsonb), '{cc}', to_jsonb(public.direct_booking_cc_emails()));
  UPDATE public.leads SET reply_to = _reply->>'to', reply_subject = _reply->>'subject', reply_body = _reply->>'body',
         reply_cc = ARRAY(SELECT jsonb_array_elements_text(coalesce(_reply->'cc', '[]'::jsonb))),
         offered_property_ids = _property_ids, updated_at = now()
   WHERE id = _lead_id;
  IF NOT public.direct_booking_approval_required(now()) THEN
    RETURN jsonb_build_object('approval_required', false, 'reply', _reply);
  END IF;
  INSERT INTO public.direct_booking_approvals(lead_id, requested_by, reply, property_ids)
  VALUES (_lead_id, auth.uid(), _reply, _property_ids)
  ON CONFLICT (lead_id) WHERE decision IS NULL DO UPDATE SET reply = EXCLUDED.reply, property_ids = EXCLUDED.property_ids
  RETURNING id INTO _approval;
  PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
    'direct_booking_approval', 'A direct booking reply needs your approval',
    'Check the homes and the reply. The clock is running.', _lead_id);
  RETURN jsonb_build_object('approval_required', true, 'approval_id', _approval, 'reply', _reply);
END $function$
