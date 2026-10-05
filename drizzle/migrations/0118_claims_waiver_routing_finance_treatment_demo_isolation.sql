-- Claims correction pass: routed waivers, Finance treatment before financial closure,
-- demo notification isolation, audited retraction, cumulative-safe corrections.

ALTER TABLE public.claim_waivers
  ADD COLUMN IF NOT EXISTS routed_to uuid,
  ADD COLUMN IF NOT EXISTS routing_basis text,
  ADD COLUMN IF NOT EXISTS routing_note text;

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS finance_treatment text,
  ADD COLUMN IF NOT EXISTS finance_treatment_note text,
  ADD COLUMN IF NOT EXISTS finance_treated_by uuid,
  ADD COLUMN IF NOT EXISTS finance_treated_at timestamptz,
  ADD COLUMN IF NOT EXISTS leadership_decision_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leadership_decision text,
  ADD COLUMN IF NOT EXISTS leadership_decided_by uuid,
  ADD COLUMN IF NOT EXISTS leadership_decided_at timestamptz;

ALTER TABLE public.staff_notifications
  ADD COLUMN IF NOT EXISTS retracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retracted_by uuid,
  ADD COLUMN IF NOT EXISTS retracted_reason text;

-- Demo events may only reach synthetic accounts explicitly designated in app_settings
-- key demo_notification_recipients ({"<seat code>": "<user id>", ...}).
CREATE OR REPLACE FUNCTION private.demo_notify_ok(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.app_settings s, jsonb_each_text(s.value) e
                WHERE s.key = 'demo_notification_recipients' AND e.value = _user_id::text)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id
                AND lower(p.email) LIKE '%@resolve-test.invalid')
$$;

CREATE OR REPLACE FUNCTION private.demo_seat_standin(_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN private.demo_notify_ok((s.value->>_code)::uuid) THEN (s.value->>_code)::uuid END
  FROM public.app_settings s WHERE s.key = 'demo_notification_recipients'
$$;

CREATE OR REPLACE FUNCTION public.notify_staff_isolated(_user_id uuid, _kind text, _title text, _body text,
  _entity_type text, _entity_id uuid, _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF coalesce(_is_demo,false) AND NOT private.demo_notify_ok(_user_id) THEN
    RETURN NULL; -- real staff never receive demo alerts because of a role they hold
  END IF;
  RETURN public.notify_staff(_user_id, _kind, _title, _body, _entity_type, _entity_id, _link_path,
    _priority, _actor_id, _email, _is_demo);
END $$;
REVOKE ALL ON FUNCTION public.notify_staff_isolated(uuid,text,text,text,text,uuid,text,text,uuid,boolean,boolean) FROM PUBLIC, anon, authenticated;

-- Routing: Pod supervisor (when the data model records one) -> Operations Supervisor seat
-- -> Director of Operations on self-conflict -> explicit exception.
CREATE OR REPLACE FUNCTION private.route_claim_waiver(_claim public.claims, _requester uuid,
  OUT routed_to uuid, OUT basis text, OUT note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _cand uuid;
BEGIN
  -- No property-to-Pod-supervisor assignment exists yet; fall through to the seat.
  _cand := CASE WHEN _claim.is_demo THEN private.demo_seat_standin('ops_supervisor')
                ELSE public.seat_holder_at('ops_supervisor') END;
  IF _cand IS NOT NULL AND NOT (private.is_supervisor(_cand) OR private.is_director(_cand)) THEN
    _cand := NULL;
  END IF;
  IF _cand IS NOT NULL AND _cand <> _requester THEN
    routed_to := _cand; basis := 'ops_supervisor_seat';
    note := 'No Pod supervisor is assigned to this home; routed to the Operations Supervisor seat.';
    RETURN;
  END IF;
  IF _cand = _requester THEN
    _cand := CASE WHEN _claim.is_demo THEN private.demo_seat_standin('director_ops')
                  ELSE public.seat_holder_at('director_ops') END;
    IF _cand IS NOT NULL AND _cand <> _requester THEN
      routed_to := _cand; basis := 'director_conflict';
      note := 'The requester holds the supervisor seat; routed to the Director of Operations.';
      RETURN;
    END IF;
  END IF;
  routed_to := NULL; basis := 'exception';
  note := 'No eligible supervisor could be found — leadership must route this waiver.';
END $$;

CREATE OR REPLACE FUNCTION public.request_claim_waiver(_claim_id uuid, _reason text, _context text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.decide_claim_waiver(_waiver_id uuid, _approve boolean, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
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
END $$;

-- Finance records the unrecovered amount's treatment; never automatic, never assumed.
CREATE OR REPLACE FUNCTION public.record_claim_finance_treatment(_claim_id uuid, _treatment text, _note text, _needs_leadership boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _c claims;
BEGIN
  IF NOT (private.is_finance_lead(auth.uid()) OR private.is_accounting(auth.uid())) THEN
    RAISE EXCEPTION 'Only Finance can record the treatment of an unrecovered amount';
  END IF;
  IF coalesce(btrim(_treatment),'') = '' OR coalesce(btrim(_note),'') = '' THEN
    RAISE EXCEPTION 'Record the treatment and the reasoning';
  END IF;
  SELECT * INTO _c FROM claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  PERFORM set_config('resolve.claim_finance','on',true);
  UPDATE claims SET finance_treatment = btrim(_treatment), finance_treatment_note = btrim(_note),
    finance_treated_by = auth.uid(), finance_treated_at = now(),
    leadership_decision_required = coalesce(_needs_leadership,false),
    leadership_decision = NULL, leadership_decided_by = NULL, leadership_decided_at = NULL,
    finance_decision_pending = CASE WHEN coalesce(_needs_leadership,false) THEN 'Leadership decision pending' END
  WHERE id = _claim_id;
  PERFORM set_config('resolve.claim_finance','off',true);
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_claim_id, auth.uid(), 'finance_treatment', 'Finance treatment: ' || btrim(_treatment) || ' — ' || btrim(_note)
    || CASE WHEN _needs_leadership THEN ' (leadership decision required)' ELSE '' END, _c.is_demo);
END $$;

CREATE OR REPLACE FUNCTION public.record_claim_leadership_decision(_claim_id uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _c claims;
BEGIN
  IF NOT private.is_director(auth.uid()) THEN RAISE EXCEPTION 'Only the Director of Operations can record this decision'; END IF;
  IF coalesce(btrim(_decision),'') = '' THEN RAISE EXCEPTION 'Record the decision'; END IF;
  SELECT * INTO _c FROM claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND OR NOT _c.leadership_decision_required THEN RAISE EXCEPTION 'No leadership decision is pending'; END IF;
  PERFORM set_config('resolve.claim_finance','on',true);
  UPDATE claims SET leadership_decision = btrim(_decision), leadership_decided_by = auth.uid(),
    leadership_decided_at = now(), finance_decision_pending = NULL WHERE id = _claim_id;
  PERFORM set_config('resolve.claim_finance','off',true);
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_claim_id, auth.uid(), 'leadership_decision', btrim(_decision), _c.is_demo);
END $$;

REVOKE ALL ON FUNCTION public.record_claim_finance_treatment(uuid,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_claim_leadership_decision(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_claim_finance_treatment(uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_claim_leadership_decision(uuid,text) TO authenticated;

-- Stage gates, now with Finance treatment before final financial closure.
CREATE OR REPLACE FUNCTION public.guard_claim_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _post_submit text[] := ARRAY['submitted','waiting_external','info_requested','decided','recovered','closed'];
        _unrec numeric;
BEGIN
  IF NEW.recovered_amount IS DISTINCT FROM OLD.recovered_amount
     AND coalesce(current_setting('resolve.claim_sync', true),'off') <> 'on' THEN
    RAISE EXCEPTION 'Received amounts are recorded by Finance in the recovery ledger';
  END IF;
  IF (NEW.finance_treatment, NEW.finance_treatment_note, NEW.finance_treated_by, NEW.finance_treated_at,
      NEW.leadership_decision_required, NEW.leadership_decision, NEW.leadership_decided_by, NEW.leadership_decided_at)
     IS DISTINCT FROM
     (OLD.finance_treatment, OLD.finance_treatment_note, OLD.finance_treated_by, OLD.finance_treated_at,
      OLD.leadership_decision_required, OLD.leadership_decision, OLD.leadership_decided_by, OLD.leadership_decided_at)
     AND coalesce(current_setting('resolve.claim_finance', true),'off') <> 'on' THEN
    RAISE EXCEPTION 'Finance treatment and leadership decisions are recorded through their own steps';
  END IF;
  IF NEW.stage = ANY(_post_submit) AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.submitted_on IS NULL OR coalesce(btrim(NEW.external_reference),'') = ''
       OR coalesce(array_length(NEW.submission_document_ids,1),0) = 0 THEN
      RAISE EXCEPTION 'Submitted needs a submission date, reference and proof of submission';
    END IF;
  END IF;
  IF NEW.stage IN ('decided','recovered') AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.disposition IS NULL OR coalesce(array_length(NEW.decision_document_ids,1),0) = 0 THEN
      RAISE EXCEPTION 'A decision needs the outcome and decision evidence';
    END IF;
  END IF;
  IF NEW.disposition IN ('approved','partial') AND NEW.approved_amount IS NULL THEN
    RAISE EXCEPTION 'Record the approved amount';
  END IF;
  IF NEW.disposition IN ('denied','withdrawn','written_off') AND coalesce(btrim(NEW.disposition_reason),'') = '' THEN
    RAISE EXCEPTION 'A denied, withdrawn or written-off claim needs a reason';
  END IF;
  IF NEW.stage = 'closed' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.disposition IS NULL THEN RAISE EXCEPTION 'Close with a recorded outcome'; END IF;
    IF EXISTS (SELECT 1 FROM claim_waivers WHERE claim_id = NEW.id AND status = 'pending') THEN
      RAISE EXCEPTION 'A waiver request is still pending';
    END IF;
    _unrec := coalesce(NEW.submitted_amount, NEW.approved_amount, 0) - coalesce(NEW.recovered_amount,0);
    IF _unrec > 0 THEN
      IF coalesce(btrim(NEW.nonrecovery_reason),'') = '' THEN
        RAISE EXCEPTION 'Explain the unrecovered amount before closing';
      END IF;
      IF NEW.finance_treated_at IS NULL THEN
        RAISE EXCEPTION 'Finance treatment of the unrecovered amount is pending';
      END IF;
      IF NEW.leadership_decision_required AND NEW.leadership_decided_at IS NULL THEN
        RAISE EXCEPTION 'A leadership decision is pending';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Ledger: corrections stay on the original's claim/expense and can never over-reverse it.
CREATE OR REPLACE FUNCTION public.guard_expense_recovery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap numeric; _sum numeric; _orig expense_recoveries; _net numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Recovery entries are append-only; record a correcting entry instead';
  END IF;
  IF NEW.claim_id IS NULL AND NEW.expense_id IS NULL THEN
    RAISE EXCEPTION 'A recovery must belong to a claim or an expense';
  END IF;
  IF NEW.corrects_id IS NULL AND NEW.received_amount <= 0 THEN
    RAISE EXCEPTION 'Received amount must be positive; use a correction to reverse';
  END IF;
  IF NEW.corrects_id IS NOT NULL THEN
    IF coalesce(btrim(NEW.note),'') = '' THEN RAISE EXCEPTION 'A correction needs a reason'; END IF;
    SELECT * INTO _orig FROM expense_recoveries WHERE id = NEW.corrects_id;
    IF NOT FOUND OR _orig.corrects_id IS NOT NULL THEN RAISE EXCEPTION 'Correct an original receipt'; END IF;
    IF _orig.claim_id IS DISTINCT FROM NEW.claim_id OR _orig.expense_id IS DISTINCT FROM NEW.expense_id THEN
      RAISE EXCEPTION 'A correction must stay on the same claim and expense allocation as the receipt';
    END IF;
    SELECT _orig.received_amount + coalesce(sum(received_amount),0) + NEW.received_amount INTO _net
      FROM expense_recoveries WHERE corrects_id = NEW.corrects_id;
    IF _net < 0 THEN RAISE EXCEPTION 'Corrections cannot exceed the original receipt (%)', _orig.received_amount; END IF;
  END IF;
  IF NEW.claim_id IS NOT NULL AND NEW.expense_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM expense_links WHERE expense_id = NEW.expense_id AND link_type='claim' AND target_id = NEW.claim_id) THEN
    RAISE EXCEPTION 'Allocate only to an expense linked to this claim';
  END IF;
  IF NEW.expense_id IS NOT NULL THEN
    SELECT amount INTO _cap FROM expenses WHERE id = NEW.expense_id FOR UPDATE;
    SELECT coalesce(sum(received_amount),0) + NEW.received_amount INTO _sum FROM expense_recoveries WHERE expense_id = NEW.expense_id;
    IF _cap IS NOT NULL AND _sum > _cap THEN
      RAISE EXCEPTION 'Recoveries would exceed the remaining recoverable expense amount (%)', _cap;
    END IF;
  END IF;
  NEW.created_by := auth.uid();
  RETURN NEW;
END $$;

-- Audited retraction of demo alerts; the row and its history stay.
CREATE OR REPLACE FUNCTION public.retract_demo_notifications(_ids uuid[], _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer; _actor uuid := auth.uid();
BEGIN
  IF _actor IS NOT NULL AND NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF EXISTS (SELECT 1 FROM staff_notifications WHERE id = ANY(_ids) AND NOT is_demo) THEN
    RAISE EXCEPTION 'Only demo notifications can be retracted';
  END IF;
  UPDATE staff_notifications SET retracted_at = now(), retracted_by = _actor, retracted_reason = _reason,
    email_status = CASE WHEN email_status = 'pending' THEN 'skipped' ELSE email_status END
  WHERE id = ANY(_ids) AND retracted_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
  VALUES (_actor, CASE WHEN _actor IS NULL THEN 'Resolve maintenance' END, 'demo_notifications_retracted',
    'staff_notification', _n || ' demo alert(s)', _reason, jsonb_build_object('ids', to_jsonb(_ids)));
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.retract_demo_notifications(uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retract_demo_notifications(uuid[],text) TO authenticated;