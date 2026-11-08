-- Alerts and approvals, part 4: approval alerts open the exact ticket (Emily, Nov 7, 2026).
-- Undo: 03_undo_approval_links.sql (the live captures). No BEGIN/COMMIT.
--
-- private.ticket_link_for(entity type, id) returns /tickets/<id> for a ticket, a work order's
-- ticket, a refund's ticket or a claim's ticket, and nothing otherwise. Each alert below now
-- stores that link (in app and in the email); when the item has no ticket the old link stays.
-- In each function only the link changes; everything else is byte-identical to the live capture.
--   notify_approval_events      approval needed            was /oversight
--   notify_unrouted_approval    send for approval          was /approvals
--   notify_recovery_approval    refund approval needed     was /recovery?open=<refund>
--   decide_recovery_approval    refund approved / declined was /recovery?open=<refund>
--   request_claim_waiver        waiver requested           was /claims?claim=<claim>
--   decide_claim_waiver         waiver decided             was /claims?claim=<claim>

CREATE OR REPLACE FUNCTION private.ticket_link_for(_entity_type text, _entity_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT '/tickets/' || t.id::text
    FROM public.tickets t
   WHERE _entity_id IS NOT NULL
     AND t.id = CASE _entity_type
       WHEN 'ticket' THEN _entity_id
       WHEN 'work_order' THEN (SELECT w.ticket_id FROM public.work_orders w WHERE w.id = _entity_id)
       WHEN 'guest_recovery' THEN (SELECT g.ticket_id FROM public.guest_recovery g WHERE g.id = _entity_id)
       WHEN 'claim' THEN (SELECT c.ticket_id FROM public.claims c WHERE c.id = _entity_id)
       ELSE NULL END
$function$;
REVOKE ALL ON FUNCTION private.ticket_link_for(text, uuid) FROM PUBLIC;

-- public.notify_approval_events
CREATE OR REPLACE FUNCTION public.notify_approval_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approver_id IS NOT NULL
     AND NEW.status = 'pending'
     AND (TG_OP = 'INSERT'
          OR NEW.approver_id IS DISTINCT FROM OLD.approver_id
          OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_staff(
      NEW.approver_id,
      'approval_required',
      'Approval needed: ' || NEW.title,
      coalesce(NEW.detail, 'Open Resolve to approve or decline.'),
      'approval', NEW.id, coalesce(private.ticket_link_for(NEW.entity_type, NEW.entity_id), '/oversight'), 'urgent',
      NEW.requested_by, true, NEW.is_demo
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- public.notify_unrouted_approval
CREATE OR REPLACE FUNCTION public.notify_unrouted_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supervisor uuid;
BEGIN
  IF NEW.status <> 'pending' OR NEW.approver_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND OLD.approver_id IS NULL THEN
    RETURN NEW;
  END IF;

  _supervisor := public.seat_holder_at('ops_supervisor', now());
  IF _supervisor IS NULL OR _supervisor = NEW.requested_by THEN
    _supervisor := NEW.requested_by;
  END IF;

  IF _supervisor IS NOT NULL THEN
    PERFORM public.notify_staff(
      _supervisor, 'approval_required',
      'Send for approval: ' || NEW.title,
      'This homeowner answers outside Resolve. Send the request, then record their answer on this approval.',
      'approval', NEW.id,
      coalesce(private.ticket_link_for(NEW.entity_type, NEW.entity_id), '/approvals'), 'normal', auth.uid(), true, NEW.is_demo
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- public.notify_recovery_approval
CREATE OR REPLACE FUNCTION public.notify_recovery_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _authority text;
  _target uuid;
  _seat text;
  _title text;
  _body text;
  _link text;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.approval_status IS NOT DISTINCT FROM NEW.approval_status THEN
    RETURN NEW;
  END IF;

  _authority := COALESCE(NEW.approval_authority, 'supervisor');
  IF _authority = 'director' THEN
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'director_ops';
  ELSE
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'ops_supervisor';
  END IF;

  IF _target IS NULL OR _target = COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RETURN NEW;
  END IF;

  _link := coalesce(private.ticket_link_for('ticket', NEW.ticket_id), '/recovery?open=' || NEW.id::text);
  _title := CASE WHEN _authority = 'director'
    THEN 'Director approval needed — guest recovery'
    ELSE 'Approval needed — guest recovery' END;
  _body := COALESCE(NEW.title, 'Guest recovery')
    || CASE WHEN NEW.proposed_amount IS NOT NULL
         THEN ' — proposed ' || to_char(NEW.proposed_amount, 'FM$999,999.00') ELSE '' END
    || CASE WHEN _authority = 'director'
         THEN '. This decision sits with the Director of Operations.'
         ELSE '. This decision sits with the Operations Supervisor.' END;

  PERFORM public.notify_staff(
    _target, 'approval_required', _title, _body,
    'guest_recovery', NEW.id, _link, 'urgent',
    NEW.requested_by, true, COALESCE(NEW.is_demo, false)
  );
  RETURN NEW;
END;
$function$;

-- public.decide_recovery_approval
CREATE OR REPLACE FUNCTION public.decide_recovery_approval(_recovery_id uuid, _decision text, _approved_amount numeric DEFAULT NULL::numeric, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _r public.guest_recovery%ROWTYPE;
  _level text;
  _amount numeric;
  _needed text;
  _target uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to decide this approval.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('approve','decline') THEN
    RAISE EXCEPTION 'Choose Approve or Decline.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Add a reason for this decision.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _r FROM public.guest_recovery WHERE id = _recovery_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF _r.approval_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'This refund is not waiting for approval.' USING ERRCODE = 'check_violation';
  END IF;

  _level := COALESCE(_r.approval_authority, 'supervisor');
  IF _level = 'director' THEN
    IF NOT public.is_director(_uid) THEN
      RAISE EXCEPTION 'Only the Director or an Admin can decide this one.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    IF NOT (public.is_supervisor(_uid) OR public.is_director(_uid)) THEN
      RAISE EXCEPTION 'Only the Operations Supervisor, the Director or an Admin can decide this one.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  PERFORM set_config('app.recovery_decision', 'on', true);

  IF _decision = 'approve' THEN
    _amount := COALESCE(_approved_amount, _r.proposed_amount);
    IF _amount IS NOT NULL AND _amount < 0 THEN
      RAISE EXCEPTION 'The approved amount cannot be negative.' USING ERRCODE = 'check_violation';
    END IF;
    _needed := public.recovery_required_authority(
      _r.recovery_action, _amount, _r.within_airbnb_policy, _r.escalation_flags);
    IF _needed = 'director' AND _level <> 'director' THEN
      RAISE EXCEPTION 'That amount needs Director approval. Ask for Director approval instead.'
        USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.guest_recovery SET
      approval_status = 'approved', stage = 'approved',
      approved_by = _uid, approved_at = now(), approved_amount = _amount,
      approval_authority = _level, decision_note = btrim(_reason), decision_at = now()
    WHERE id = _recovery_id;
  ELSE
    UPDATE public.guest_recovery SET
      approval_status = 'declined', stage = 'decision_drafted',
      approved_by = _uid, approved_at = now(), approved_amount = NULL,
      approval_authority = _level, decision_note = btrim(_reason), decision_at = now()
    WHERE id = _recovery_id;
  END IF;

  PERFORM set_config('app.recovery_decision', 'off', true);

  INSERT INTO public.guest_recovery_activity(recovery_id, author_id, event_type, body, detail, is_demo)
  VALUES (
    _recovery_id, _uid,
    CASE WHEN _decision = 'approve' THEN 'approval_approved' ELSE 'approval_declined' END,
    CASE WHEN _decision = 'approve'
      THEN 'Approved' || CASE WHEN _amount IS NOT NULL THEN ' at ' || to_char(_amount, 'FM$999,999.00') ELSE '' END
      ELSE 'Declined' END || ': ' || btrim(_reason),
    jsonb_build_object('authority', _level, 'amount', _amount, 'reason', btrim(_reason)),
    COALESCE(_r.is_demo, false)
  );

  _target := COALESCE(_r.requested_by, _r.created_by);
  IF _target IS NOT NULL AND _target <> _uid THEN
    PERFORM public.notify_staff(
      _target, 'approval_decided',
      CASE WHEN _decision = 'approve' THEN 'Refund approved' ELSE 'Refund declined' END,
      COALESCE(_r.title, 'Guest recovery') || ': ' || btrim(_reason),
      'guest_recovery', _recovery_id, coalesce(private.ticket_link_for('ticket', _r.ticket_id), '/recovery?open=' || _recovery_id::text), 'normal',
      _uid, false, COALESCE(_r.is_demo, false)
    );
  END IF;
END
$function$;

-- public.request_claim_waiver
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
      _reason, 'claim', _claim_id, coalesce(private.ticket_link_for('ticket', _c.ticket_id), '/claims?claim=' || _claim_id), 'normal', auth.uid(), false, _c.is_demo);
  END IF;
  RETURN _id;
END $function$;

-- public.decide_claim_waiver
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
      _notes, 'claim', _c.id, coalesce(private.ticket_link_for('ticket', _c.ticket_id), '/claims?claim=' || _c.id), 'normal', auth.uid(), false, _c.is_demo);
  END LOOP;
END $function$;
