CREATE OR REPLACE FUNCTION public.request_claim_waiver(_claim_id uuid, _reason text, _context text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid; _c claims; _r record;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A waiver request needs a reason'; END IF;
  SELECT * INTO _c FROM claims WHERE id = _claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  SELECT id INTO _id FROM claim_waivers WHERE claim_id=_claim_id AND status='pending';
  IF _id IS NOT NULL THEN RETURN _id; END IF; -- retry-safe, no second alert
  SELECT * INTO _r FROM private.route_claim_waiver(_c, auth.uid());
  INSERT INTO claim_waivers(claim_id, requested_by, reason, context, is_demo, routed_to, routing_basis, routing_note)
  VALUES (_claim_id, auth.uid(), _reason, _context, _c.is_demo, _r.routed_to, _r.basis, _r.note) RETURNING id INTO _id;
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_claim_id, auth.uid(), CASE WHEN _r.routed_to IS NULL THEN 'waiver_routing_exception' ELSE 'waiver_requested' END,
          _reason || ' — ' || _r.note, _c.is_demo);
  IF _r.routed_to IS NOT NULL THEN
    PERFORM public.notify_staff_isolated(_r.routed_to, 'claim_waiver', 'Waiver requested: ' || coalesce(_c.title,'claim'),
      _reason, 'claim', _claim_id, '/claims?claim=' || _claim_id, 'normal', auth.uid(), false, _c.is_demo);
  END IF;
  RETURN _id;
END $function$

