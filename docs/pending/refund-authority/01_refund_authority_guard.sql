-- Refund and compensation authority guard (Emily, Nov 4 2026 SOP review).
-- Adds two new functions and one new trigger on public.guest_recovery.
-- Nothing existing is replaced and no row is changed.
--
-- Mirrors evaluateAuthority in src/lib/guest-recovery.ts with the limits in
-- src/lib/recovery-policy.ts. src/lib/__tests__/refund-authority-sql.test.ts
-- fails if the limits, flag list or remedy lists here drift from the app.

CREATE FUNCTION public.recovery_required_authority(
  _action text,
  _amount numeric,
  _within_policy boolean,
  _flags text[]
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  _pc_ceiling CONSTANT numeric := 500;
  _supervisor_ceiling CONSTANT numeric := 1500;
  _director_flags CONSTANT text[] := ARRAY[
    'outside_policy','multi_night_refund','relocation','legal_threat','chargeback_threat',
    'safety_allegation','discrimination_allegation','emergency_services','insurance_exposure',
    'property_damage','owner_dispute','policy_exception','reputational_risk','supervisor_uncertain'
  ];
  _multi_night_actions CONSTANT text[] := ARRAY['full_refund','shorten_stay'];
BEGIN
  -- Director whatever the amount: recorded flags, or flags the remedy itself forces.
  IF COALESCE(_flags, '{}'::text[]) && _director_flags
     OR _action = ANY (_multi_night_actions)
     OR _action = 'relocation'
     OR _within_policy IS FALSE THEN
    RETURN 'director';
  END IF;
  IF _action IN ('none','apology') OR _amount IS NULL THEN
    RETURN 'pc';
  END IF;
  IF _amount > _supervisor_ceiling THEN RETURN 'director'; END IF;
  IF _amount > _pc_ceiling THEN RETURN 'supervisor'; END IF;
  RETURN 'pc';
END
$fn$;

CREATE FUNCTION public.guard_recovery_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _monetary_actions CONSTANT text[] := ARRAY[
    'courtesy_item','mitigation','credit','partial_refund','full_night_refund',
    'full_refund','fee_waiver','relocation','other'
  ];
  _required text;
  _recorded text;
  _req_rank int;
  _rec_rank int;
  _label text;
BEGIN
  -- Only re-check when something the rule depends on changes, so unrelated
  -- edits to existing rows (notes, guest updates) are never blocked.
  IF TG_OP = 'UPDATE' AND (
       NEW.recovery_action, NEW.proposed_amount, NEW.within_airbnb_policy, NEW.escalation_flags,
       NEW.approval_status, NEW.approval_authority, NEW.authority_level, NEW.decision_reason,
       NEW.stage, NEW.delivered_amount
     ) IS NOT DISTINCT FROM (
       OLD.recovery_action, OLD.proposed_amount, OLD.within_airbnb_policy, OLD.escalation_flags,
       OLD.approval_status, OLD.approval_authority, OLD.authority_level, OLD.decision_reason,
       OLD.stage, OLD.delivered_amount
     ) THEN
    RETURN NEW;
  END IF;

  IF NEW.recovery_action = ANY (_monetary_actions)
     AND NEW.proposed_amount IS NOT NULL
     AND COALESCE(btrim(NEW.decision_reason), '') = '' THEN
    RAISE EXCEPTION 'Add a short written reason for this refund or compensation.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Emergencies act first and are reviewed afterwards.
  IF COALESCE(NEW.approval_authority, NEW.authority_level) = 'emergency' THEN
    RETURN NEW;
  END IF;

  _required := public.recovery_required_authority(
    NEW.recovery_action, NEW.proposed_amount, NEW.within_airbnb_policy, NEW.escalation_flags);
  _req_rank := CASE _required WHEN 'director' THEN 3 WHEN 'supervisor' THEN 2 ELSE 1 END;
  _label := CASE _required WHEN 'director' THEN 'Director' ELSE 'Supervisor' END;

  IF NEW.approval_status IN ('pending','approved') THEN
    _recorded := COALESCE(NEW.approval_authority, NEW.authority_level);
    _rec_rank := CASE _recorded WHEN 'director' THEN 3 WHEN 'supervisor' THEN 2
                                WHEN 'pc' THEN 1 WHEN 'self' THEN 1 ELSE 0 END;
    IF _rec_rank < _req_rank THEN
      RAISE EXCEPTION 'This needs % approval. It cannot be approved at a lower level.', _label
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.approval_status = 'not_required' AND _req_rank > 1 THEN
    IF NEW.delivered_amount IS NOT NULL
       OR (NEW.stage IN ('approved','guest_offered','guest_accepted','completed','closed')
           AND COALESCE(NEW.outcome, '') NOT IN ('withdrawn','declined_no_compensation')) THEN
      RAISE EXCEPTION 'This needs % approval before it can move on. Request approval first.', _label
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END
$fn$;

CREATE TRIGGER guard_recovery_authority_trg
  BEFORE INSERT OR UPDATE ON public.guest_recovery
  FOR EACH ROW EXECUTE FUNCTION public.guard_recovery_authority();

REVOKE ALL ON FUNCTION public.recovery_required_authority(text, numeric, boolean, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_recovery_authority() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recovery_required_authority(text, numeric, boolean, text[]) TO service_role;

COMMENT ON FUNCTION public.recovery_required_authority(text, numeric, boolean, text[]) IS
  'Refund authority: coordinator up to and including 500, Supervisor over 500, Director over 1500 or whenever a Director flag applies. Mirrors evaluateAuthority.';
