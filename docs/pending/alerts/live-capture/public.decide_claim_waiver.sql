CREATE OR REPLACE FUNCTION public.decide_claim_waiver(_waiver_id uuid, _approve boolean, _notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _w claim_waivers; _c claims; _who uuid;
BEGIN
  IF coalesce(btrim(_notes),'') = '' THEN RAISE EXCEPTION 'Decision notes are required'; END IF;
  SELECT * INTO _w FROM claim_waivers WHERE id = _waiver_id FOR UPDATE;
  IF NOT FOUND OR _w.status <> 'pending' THEN RAISE EXCEPTION 'Waiver is not pending'; END IF;
  IF _w.requested_by = auth.uid() THEN RAISE EXCEPTION 'You cannot decide your own waiver request'; END IF;
  IF NOT (auth.uid() = _w.routed_to OR private.is_director(auth.uid())) THEN
    RAISE EXCEPTION 'Only the supervisor this waiver was routed to, or the Director of Operations, can decide it';
  END IF;
  UPDATE claim_waivers SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
    decided_by = auth.uid(), decision_notes = _notes, decided_at = now() WHERE id = _waiver_id;
  SELECT * INTO _c FROM claims WHERE id = _w.claim_id;
  IF _approve THEN
    UPDATE claims SET finance_decision_pending = 'Waiver approved — Finance treatment pending' WHERE id = _c.id;
  END IF;
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_c.id, auth.uid(), CASE WHEN _approve THEN 'waiver_approved' ELSE 'waiver_denied' END,
    _notes || CASE WHEN _approve THEN ' — Waiver approved — Finance treatment pending' ELSE '' END, _c.is_demo);
  FOR _who IN SELECT DISTINCT x FROM unnest(ARRAY[_w.requested_by, _c.assigned_to]) x WHERE x IS NOT NULL AND x <> auth.uid() LOOP
    PERFORM public.notify_staff_isolated(_who, 'claim_waiver_decision',
      'Waiver ' || CASE WHEN _approve THEN 'approved' ELSE 'denied' END || ': ' || coalesce(_c.title,'claim'),
      _notes, 'claim', _c.id, '/claims?claim=' || _c.id, 'normal', auth.uid(), false, _c.is_demo);
  END LOOP;
END $function$

