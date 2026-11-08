-- Alerts and approvals, part 5: Claim card decision (Emily, Nov 7, 2026; register C2, C3).
-- Undo: 04_undo_claim_approval.sql. No BEGIN/COMMIT.
--
-- Claim authority (C2), the same ladder as refunds: a coordinator up to and including $500;
-- the Operations Supervisor above $500 up to and including $1,500; the Director of Operations above.
--   private.claim_required_authority(amount)   coordinator | supervisor | director
--   public.request_claim_approval(claim, amount) Ask for approval (Operations only); alerts the
--     Operations Supervisor or the Director of Operations in app and email, link to the ticket.
--   public.decide_claim_approval(claim, approve|decline, reason) Approve or Decline with a
--     required reason; the role is checked here, like decide_recovery_approval.
--   guard_claim_approval (BEFORE UPDATE): the approval fields change only through the two
--     functions, and a claim over $500 cannot move to Submitted (or later) without an approval at
--     the right level for at least that amount. Claims up to $500 are unchanged.
-- Nothing else about claims changes; guard_claim_workflow is untouched.

ALTER TABLE public.claims
  ADD COLUMN approval_status text CHECK (approval_status IN ('pending', 'approved', 'declined')),
  ADD COLUMN approval_authority text CHECK (approval_authority IN ('supervisor', 'director')),
  ADD COLUMN approval_amount numeric CHECK (approval_amount > 0),
  ADD COLUMN approval_requested_by uuid,
  ADD COLUMN approval_requested_at timestamptz,
  ADD COLUMN approval_decided_by uuid,
  ADD COLUMN approval_decided_at timestamptz,
  ADD COLUMN approval_reason text;

CREATE OR REPLACE FUNCTION private.claim_required_authority(_amount numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _amount IS NULL OR _amount <= 500 THEN 'coordinator'
    WHEN _amount <= 1500 THEN 'supervisor'
    ELSE 'director'
  END
$function$;

CREATE OR REPLACE FUNCTION public.request_claim_approval(_claim_id uuid, _amount numeric)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _c public.claims%ROWTYPE;
  _level text;
  _target uuid;
  _money text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to ask for approval.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT (public.has_role(_uid, 'tech') OR public.is_supervisor(_uid) OR public.is_director(_uid)) THEN
    RAISE EXCEPTION 'Only Operations can ask for a claim approval.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Enter the amount to claim.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _c FROM public.claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF private.is_synthetic_account() AND NOT coalesce(_c.is_demo, false) THEN
    RAISE EXCEPTION 'Claim not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF _c.approval_status = 'pending' THEN
    RAISE EXCEPTION 'This claim is already waiting for a decision.' USING ERRCODE = 'check_violation';
  END IF;

  _level := private.claim_required_authority(_amount);
  IF _level = 'coordinator' THEN
    RAISE EXCEPTION 'Up to $500 needs no approval. Go ahead.' USING ERRCODE = 'check_violation';
  END IF;
  _money := to_char(_amount, 'FM$999,999.00');

  PERFORM set_config('app.claim_approval', 'on', true);
  UPDATE public.claims SET
    approval_status = 'pending', approval_authority = _level, approval_amount = _amount,
    approval_requested_by = _uid, approval_requested_at = now(),
    approval_decided_by = NULL, approval_decided_at = NULL, approval_reason = NULL
  WHERE id = _claim_id;
  PERFORM set_config('app.claim_approval', 'off', true);

  INSERT INTO public.claim_activity(claim_id, author_id, event_type, body, detail, is_demo)
  VALUES (_claim_id, _uid, 'approval_requested', 'Asked for approval at ' || _money,
          jsonb_build_object('authority', _level, 'amount', _amount), coalesce(_c.is_demo, false));

  _target := public.seat_holder_at(CASE WHEN _level = 'director' THEN 'director_ops' ELSE 'ops_supervisor' END, now());
  IF _target IS NOT NULL THEN
    PERFORM public.notify_staff_isolated(
      _target, 'approval_required',
      CASE WHEN _level = 'director' THEN 'Director approval needed: claim' ELSE 'Approval needed: claim' END,
      coalesce(_c.title, 'Claim') || ' for ' || _money
        || CASE WHEN _level = 'director'
             THEN '. This decision sits with the Director of Operations.'
             ELSE '. This decision sits with the Operations Supervisor.' END,
      'claim', _claim_id,
      coalesce(private.ticket_link_for('ticket', _c.ticket_id), '/claims?claim=' || _claim_id::text),
      'urgent', _uid, true, coalesce(_c.is_demo, false));
  END IF;
  RETURN _level;
END;
$function$;
REVOKE ALL ON FUNCTION public.request_claim_approval(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_claim_approval(uuid, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_claim_approval(_claim_id uuid, _decision text, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _c public.claims%ROWTYPE;
  _level text;
  _target uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to decide this approval.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('approve', 'decline') THEN
    RAISE EXCEPTION 'Choose Approve or Decline.' USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Add a reason for this decision.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _c FROM public.claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF private.is_synthetic_account() AND NOT coalesce(_c.is_demo, false) THEN
    RAISE EXCEPTION 'Claim not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF _c.approval_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'This claim is not waiting for approval.' USING ERRCODE = 'check_violation';
  END IF;

  _level := coalesce(_c.approval_authority, 'supervisor');
  IF _level = 'director' THEN
    IF NOT public.is_director(_uid) THEN
      RAISE EXCEPTION 'Only the Director of Operations or an Admin can decide this one.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT (public.is_supervisor(_uid) OR public.is_director(_uid)) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor, the Director of Operations or an Admin can decide this one.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('app.claim_approval', 'on', true);
  UPDATE public.claims SET
    approval_status = CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'declined' END,
    approval_decided_by = _uid, approval_decided_at = now(), approval_reason = btrim(_reason)
  WHERE id = _claim_id;
  PERFORM set_config('app.claim_approval', 'off', true);

  INSERT INTO public.claim_activity(claim_id, author_id, event_type, body, detail, is_demo)
  VALUES (_claim_id, _uid,
          CASE WHEN _decision = 'approve' THEN 'approval_approved' ELSE 'approval_declined' END,
          CASE WHEN _decision = 'approve' THEN 'Approved at ' || to_char(_c.approval_amount, 'FM$999,999.00') ELSE 'Declined' END
            || ': ' || btrim(_reason),
          jsonb_build_object('authority', _level, 'amount', _c.approval_amount, 'reason', btrim(_reason)),
          coalesce(_c.is_demo, false));

  _target := _c.approval_requested_by;
  IF _target IS NOT NULL AND _target <> _uid THEN
    PERFORM public.notify_staff_isolated(
      _target, 'approval_decided',
      CASE WHEN _decision = 'approve' THEN 'Claim approved' ELSE 'Claim declined' END,
      coalesce(_c.title, 'Claim') || ': ' || btrim(_reason),
      'claim', _claim_id,
      coalesce(private.ticket_link_for('ticket', _c.ticket_id), '/claims?claim=' || _claim_id::text),
      'normal', _uid, false, coalesce(_c.is_demo, false));
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.decide_claim_approval(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_claim_approval(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.guard_claim_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _post_submit text[] := ARRAY['submitted','waiting_external','info_requested','decided','recovered','closed'];
  _amount numeric;
  _needed text;
BEGIN
  IF (NEW.approval_status, NEW.approval_authority, NEW.approval_amount, NEW.approval_requested_by,
      NEW.approval_requested_at, NEW.approval_decided_by, NEW.approval_decided_at, NEW.approval_reason)
     IS DISTINCT FROM
     (OLD.approval_status, OLD.approval_authority, OLD.approval_amount, OLD.approval_requested_by,
      OLD.approval_requested_at, OLD.approval_decided_by, OLD.approval_decided_at, OLD.approval_reason)
     AND coalesce(current_setting('app.claim_approval', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Claim approvals are recorded with Ask for approval and the decision.' USING ERRCODE = 'check_violation';
  END IF;

  IF coalesce(current_setting('resolve.import_quiet', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.stage = ANY(_post_submit) AND NOT (OLD.stage = ANY(_post_submit)) THEN
    _amount := coalesce(NEW.submitted_amount, NEW.estimated_amount);
    _needed := private.claim_required_authority(_amount);
    IF _needed <> 'coordinator'
       AND NOT coalesce(NEW.approval_status = 'approved'
                AND NEW.approval_amount >= _amount
                AND (_needed = 'supervisor' OR NEW.approval_authority = 'director'), false) THEN
      RAISE EXCEPTION '%', CASE WHEN _needed = 'director'
        THEN 'A claim over $1,500 needs the Director of Operations to approve it before it is sent.'
        ELSE 'A claim over $500 needs the Operations Supervisor to approve it before it is sent.' END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_claim_approval() FROM PUBLIC;

CREATE TRIGGER guard_claim_approval
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION private.guard_claim_approval();
