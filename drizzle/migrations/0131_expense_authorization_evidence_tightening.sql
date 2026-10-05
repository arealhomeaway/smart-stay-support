ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS supervisor_approval_decided_by uuid;
COMMENT ON COLUMN public.work_orders.supervisor_approval_decided_by IS 'Who recorded the supervisor decision (stamped by trigger; must hold supervisor/director/admin authority).';

-- Only a supervisor, Director or administrator may record a supervisor decision; the decider is stamped.
CREATE OR REPLACE FUNCTION private.wo_supervisor_decision_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NEW.supervisor_approval_status IN ('approved','declined')
     AND NEW.supervisor_approval_status IS DISTINCT FROM OLD.supervisor_approval_status THEN
    IF uid IS NULL THEN
      NEW.supervisor_approval_decided_by := NULL; -- system writes never count as an authorized decision
    ELSIF private.is_supervisor(uid) OR private.is_director(uid) THEN
      NEW.supervisor_approval_decided_by := uid;
    ELSE
      RAISE EXCEPTION 'Only a supervisor, the Director of Operations or an administrator can record a supervisor decision';
    END IF;
  ELSIF NEW.supervisor_approval_status IS DISTINCT FROM OLD.supervisor_approval_status THEN
    NEW.supervisor_approval_decided_by := NULL;
  ELSE
    NEW.supervisor_approval_decided_by := OLD.supervisor_approval_decided_by;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wo_supervisor_decision_guard ON public.work_orders;
CREATE TRIGGER wo_supervisor_decision_guard BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION private.wo_supervisor_decision_guard();

-- One evaluation of required authorization for an expense. Thresholds come only from
-- app_settings 'maintenance_authority_policy'; missing policy fails closed.
-- A written note never satisfies a required approval.
CREATE OR REPLACE FUNCTION private.expense_authorization_detail(e public.expenses)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE wo public.work_orders; ap public.approvals; pol jsonb; sup numeric; own numeric; who text;
BEGIN
  IF e.expense_type IS DISTINCT FROM 'vendor_service' OR e.amount IS NULL THEN
    RETURN jsonb_build_object('required',false,'ok',true,'reason','Not required by the Maintenance Authority Policy.');
  END IF;
  SELECT value INTO pol FROM public.app_settings WHERE key = 'maintenance_authority_policy';
  sup := (pol->>'supervisorApprovalThreshold')::numeric; own := (pol->>'ownerApprovalThreshold')::numeric;
  IF sup IS NULL OR own IS NULL THEN
    RETURN jsonb_build_object('required',true,'ok',false,'who','owner','reason','The Maintenance Authority Policy is not configured, so authorization cannot be confirmed.');
  END IF;
  SELECT w.* INTO wo FROM public.expense_links l JOIN public.work_orders w ON w.id = l.target_id
   WHERE l.expense_id = e.id AND l.link_type = 'work_order' ORDER BY l.created_at LIMIT 1;
  IF wo.id IS NOT NULL AND wo.phase = 'mitigation' AND wo.emergency_reason IS NOT NULL THEN
    RETURN jsonb_build_object('required',false,'ok',true,'reason','Emergency mitigation exception recorded on the linked Work Order.','policy_version',pol->>'version');
  END IF;
  IF e.amount > own AND NOT coalesce(wo.contractual_exception,false) THEN who := 'owner';
  ELSIF e.amount >= sup THEN who := 'supervisor';
  ELSE RETURN jsonb_build_object('required',false,'ok',true,'reason','Below the supervisor approval threshold — no approval required.','policy_version',pol->>'version');
  END IF;

  IF wo.id IS NOT NULL THEN
    IF coalesce(wo.authorization_stale,false) THEN
      RETURN jsonb_build_object('required',true,'ok',false,'who',who,'reason','The Work Order approval no longer covers its vendor, scope or amount — it must be re-approved.');
    END IF;
    IF who = 'owner' AND wo.approval_status = 'approved' THEN
      SELECT * INTO ap FROM public.approvals a WHERE a.id = wo.approval_id AND a.status = 'approved'
        AND a.approver_role = 'owner' AND a.decided_at IS NOT NULL AND a.entity_type = 'work_order' AND a.entity_id = wo.id;
      IF ap.id IS NOT NULL AND coalesce(ap.amount,0) >= e.amount AND coalesce(wo.authorized_amount,0) >= e.amount THEN
        RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','Owner approval recorded on the linked Work Order covers this amount.','approval_id',ap.id);
      END IF;
    ELSIF who = 'supervisor' AND wo.supervisor_approval_status = 'approved' AND wo.supervisor_approval_decided_by IS NOT NULL
      AND (private.is_supervisor(wo.supervisor_approval_decided_by) OR private.is_director(wo.supervisor_approval_decided_by))
      AND coalesce(wo.authorized_amount,0) >= e.amount THEN
      RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','Supervisor approval recorded on the linked Work Order covers this amount.','decided_by',wo.supervisor_approval_decided_by);
    END IF;
  END IF;

  IF e.approval_id IS NOT NULL THEN
    SELECT * INTO ap FROM public.approvals a WHERE a.id = e.approval_id AND a.status = 'approved' AND a.decided_at IS NOT NULL
      AND coalesce(a.amount,0) >= e.amount
      AND ((a.entity_type = 'expense' AND a.entity_id = e.id) OR (wo.id IS NOT NULL AND a.entity_type = 'work_order' AND a.entity_id = wo.id));
    IF ap.id IS NOT NULL AND (
         (who = 'owner' AND ap.approver_role = 'owner')
      OR (who = 'supervisor' AND ap.approver_id IS NOT NULL AND (private.is_supervisor(ap.approver_id) OR private.is_director(ap.approver_id)))) THEN
      RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','A linked approval by an authorized decision-maker covers this amount.','approval_id',ap.id);
    END IF;
  END IF;

  RETURN jsonb_build_object('required',true,'ok',false,'who',who,
    'reason', CASE WHEN who = 'owner'
      THEN 'Owner approval covering this amount is not recorded on the linked Work Order. A written note does not count.'
      ELSE 'Supervisor approval by an authorized supervisor, covering this amount, is not recorded on the linked Work Order. A written note does not count.' END);
END $$;

CREATE OR REPLACE FUNCTION private.expense_authorization_ok(e public.expenses)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT (private.expense_authorization_detail(e)->>'ok')::boolean
$$;

CREATE OR REPLACE FUNCTION public.expense_authorization_status(_expense uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE e public.expenses;
BEGIN
  IF NOT coalesce(public.is_internal_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Staff only'; END IF;
  SELECT * INTO e FROM public.expenses WHERE id = _expense;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN private.expense_authorization_detail(e);
END $$;
REVOKE ALL ON FUNCTION public.expense_authorization_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expense_authorization_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.expense_review_readiness_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','private' AS $function$
DECLARE a jsonb;
BEGIN
  IF NEW.finance_review = 'reviewed' AND OLD.finance_review IS DISTINCT FROM 'reviewed' THEN
    IF NEW.is_estimate THEN RAISE EXCEPTION 'This is an estimate — convert it to the actual invoice (or archive it as replaced) before Finance review'; END IF;
    IF NEW.duplicate_flag = 'suspected' THEN RAISE EXCEPTION 'Resolve the suspected duplicate first — mark it "Not a duplicate" or archive the duplicate entry'; END IF;
    IF private.expense_evidence_changed(OLD, NEW) THEN RAISE EXCEPTION 'Save evidence changes before completing Finance review'; END IF;
    IF NOT private.expense_documentation_ok(NEW) THEN
      RAISE EXCEPTION 'Documentation is incomplete — a stored invoice or itemized receipt (and any required facts and photos) must be on record before Finance review';
    END IF;
    a := private.expense_authorization_detail(NEW);
    IF NOT (a->>'ok')::boolean THEN RAISE EXCEPTION 'Authorization is missing — %', a->>'reason'; END IF;
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
DECLARE e public.expenses; a jsonb;
BEGIN
  IF NEW.disposition = 'include' THEN
    SELECT * INTO e FROM public.expenses WHERE id = NEW.expense_id;
    a := private.expense_authorization_detail(e);
    IF NOT (a->>'ok')::boolean THEN RAISE EXCEPTION 'Authorization is missing — %', a->>'reason'; END IF;
  END IF;
  RETURN NEW;
END $$;