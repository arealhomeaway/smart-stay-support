-- Refund and compensation Approve / Decline (Emily, Nov 4 2026).
-- Adds one caller-authenticated function and one trigger on public.guest_recovery.
-- Nothing existing is replaced and no row is changed. Apply after 01 and 02.
--
-- public.decide_recovery_approval(id, decision, approved_amount, reason):
--   * caller must be signed in;
--   * the refund must be awaiting approval (approval_status = 'pending');
--   * Supervisor level: Operations Supervisor, Director or Admin may decide;
--     Director level: Director or Admin only (public.is_supervisor / public.is_director);
--   * a reason is always required;
--   * Approve: approval_status approved, stage approved, approved_by, approved_at,
--     approved_amount (defaults to the proposed amount; may not need a higher level
--     than the one recorded), decision_note, decision_at;
--   * Decline: approval_status declined, stage back to decision_drafted, approved_by,
--     approved_at, decision_note, decision_at; approved_amount cleared;
--   * writes a history entry and an in-app notice to the requester (no email).
-- guard_recovery_decision_trg: approval_status may only become approved or declined
-- through that function, so a direct table update cannot skip the role check.

CREATE FUNCTION public.decide_recovery_approval(
  _recovery_id uuid,
  _decision text,
  _approved_amount numeric DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
      'guest_recovery', _recovery_id, '/recovery?open=' || _recovery_id::text, 'normal',
      _uid, false, COALESCE(_r.is_demo, false)
    );
  END IF;
END
$fn$;

CREATE FUNCTION public.guard_recovery_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.approval_status IN ('approved','declined')
     AND NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND current_setting('app.recovery_decision', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use Approve or Decline on the refund to record this decision.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER guard_recovery_decision_trg
  BEFORE UPDATE ON public.guest_recovery
  FOR EACH ROW EXECUTE FUNCTION public.guard_recovery_decision();

REVOKE ALL ON FUNCTION public.decide_recovery_approval(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_recovery_approval(uuid, text, numeric, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_recovery_decision() FROM PUBLIC, anon, authenticated;
