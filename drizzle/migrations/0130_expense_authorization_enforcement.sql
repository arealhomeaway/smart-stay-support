-- Mirrors evaluateAuthority / authorizationNeed (ARHA Maintenance Authority Policy v2:
-- supervisor band from 200, owner above 350, contractual exception -> supervisor,
-- emergency mitigation -> no prior approval). Keep in sync with src/lib/maintenance-policy.ts.
CREATE OR REPLACE FUNCTION private.expense_authorization_ok(e public.expenses)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE wo public.work_orders; who text;
BEGIN
  IF e.expense_type IS DISTINCT FROM 'vendor_service' OR e.amount IS NULL THEN RETURN true; END IF;
  SELECT w.* INTO wo FROM public.expense_links l JOIN public.work_orders w ON w.id = l.target_id
   WHERE l.expense_id = e.id AND l.link_type = 'work_order' ORDER BY l.created_at LIMIT 1;
  IF wo.id IS NOT NULL AND wo.phase = 'mitigation' AND wo.emergency_reason IS NOT NULL THEN RETURN true; END IF;
  IF e.amount > 350 AND NOT coalesce(wo.contractual_exception,false) THEN who := 'owner';
  ELSIF e.amount >= 200 THEN who := 'supervisor';
  ELSE RETURN true; END IF;
  IF e.approval_id IS NOT NULL OR coalesce(btrim(e.authorization_note),'') <> '' THEN RETURN true; END IF;
  IF who = 'owner' THEN RETURN coalesce(wo.approval_status = 'approved', false); END IF;
  RETURN coalesce(wo.supervisor_approval_status = 'approved', false);
END $$;

CREATE OR REPLACE FUNCTION public.expense_review_readiness_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','private' AS $function$
BEGIN
  IF NEW.finance_review = 'reviewed' AND OLD.finance_review IS DISTINCT FROM 'reviewed' THEN
    IF NEW.is_estimate THEN RAISE EXCEPTION 'This is an estimate — convert it to the actual invoice (or archive it as replaced) before Finance review'; END IF;
    IF NEW.duplicate_flag = 'suspected' THEN RAISE EXCEPTION 'Resolve the suspected duplicate first — mark it "Not a duplicate" or archive the duplicate entry'; END IF;
    IF private.expense_evidence_changed(OLD, NEW) THEN RAISE EXCEPTION 'Save evidence changes before completing Finance review'; END IF;
    IF NOT private.expense_documentation_ok(NEW) THEN
      RAISE EXCEPTION 'Documentation is incomplete — a stored invoice or itemized receipt (and any required facts and photos) must be on record before Finance review';
    END IF;
    IF NOT private.expense_authorization_ok(NEW) THEN
      RAISE EXCEPTION 'Authorization evidence is missing — the Maintenance Authority Policy requires a recorded approval (or a recorded exception) for this amount before Finance review';
    END IF;
  ELSIF OLD.finance_review = 'reviewed' AND NEW.finance_review = 'reviewed' AND private.expense_evidence_changed(OLD, NEW) THEN
    IF coalesce(btrim(NEW.change_reason),'') = '' THEN
      RAISE EXCEPTION 'This expense was reviewed by Finance. Give a reason for changing its required evidence';
    END IF;
    PERFORM set_config('resolve.evidence_reason', btrim(NEW.change_reason), true);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION private.statement_include_authorization_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE e public.expenses;
BEGIN
  IF NEW.disposition = 'include' THEN
    SELECT * INTO e FROM public.expenses WHERE id = NEW.expense_id;
    IF NOT private.expense_authorization_ok(e) THEN
      RAISE EXCEPTION 'Authorization evidence is missing — the Maintenance Authority Policy requires a recorded approval (or a recorded exception) before Include';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS statement_include_authorization_guard ON public.statement_dispositions;
CREATE TRIGGER statement_include_authorization_guard BEFORE INSERT ON public.statement_dispositions
FOR EACH ROW EXECUTE FUNCTION private.statement_include_authorization_guard();