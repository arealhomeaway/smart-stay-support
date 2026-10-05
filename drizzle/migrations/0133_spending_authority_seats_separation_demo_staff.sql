-- Spending approval authority: Operations Supervisor or Director of Operations seat only
-- (seat holder, active cover, or designated seat member). Admin/manager/Finance alone never qualify.
CREATE OR REPLACE FUNCTION private.can_approve_spending(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT _uid IS NOT NULL AND (
    public.seat_holder_at('ops_supervisor', now()) = _uid
    OR public.seat_holder_at('director_ops', now()) = _uid
    OR EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code IN ('ops_supervisor','director_ops')))
$$;

CREATE OR REPLACE FUNCTION private.wo_supervisor_decision_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NEW.supervisor_approval_status IN ('approved','declined')
     AND NEW.supervisor_approval_status IS DISTINCT FROM OLD.supervisor_approval_status THEN
    IF uid IS NULL THEN
      NEW.supervisor_approval_decided_by := NULL;
    ELSIF private.can_approve_spending(uid) THEN
      NEW.supervisor_approval_decided_by := uid;
    ELSE
      RAISE EXCEPTION 'Only the Operations Supervisor or Director of Operations can record a supervisor spending decision';
    END IF;
  ELSIF NEW.supervisor_approval_status IS DISTINCT FROM OLD.supervisor_approval_status THEN
    NEW.supervisor_approval_decided_by := NULL;
  ELSE
    NEW.supervisor_approval_decided_by := OLD.supervisor_approval_decided_by;
  END IF;
  RETURN NEW;
END $$;

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
    RETURN jsonb_build_object('required',false,'ok',true,'reason','Emergency mitigation exception recorded on the linked Work Order.');
  END IF;
  IF e.amount > own AND NOT coalesce(wo.contractual_exception,false) THEN who := 'owner';
  ELSIF e.amount >= sup THEN who := 'supervisor';
  ELSE RETURN jsonb_build_object('required',false,'ok',true,'reason','Below the supervisor approval threshold — no approval required.');
  END IF;
  IF wo.id IS NOT NULL THEN
    IF coalesce(wo.authorization_stale,false) THEN
      RETURN jsonb_build_object('required',true,'ok',false,'who',who,'reason','The Work Order approval no longer covers its vendor, scope or amount — it must be re-approved.');
    END IF;
    IF who = 'owner' AND wo.approval_status = 'approved' THEN
      SELECT * INTO ap FROM public.approvals a WHERE a.id = wo.approval_id AND a.status = 'approved'
        AND a.approver_role = 'owner' AND a.decided_at IS NOT NULL AND a.entity_type = 'work_order' AND a.entity_id = wo.id;
      IF ap.id IS NOT NULL AND coalesce(ap.amount,0) >= e.amount AND coalesce(wo.authorized_amount,0) >= e.amount THEN
        RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','Owner approval recorded on the linked Work Order covers this amount.');
      END IF;
    ELSIF who = 'supervisor' AND wo.supervisor_approval_status = 'approved'
      AND private.can_approve_spending(wo.supervisor_approval_decided_by)
      AND coalesce(wo.authorized_amount,0) >= e.amount THEN
      RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','Supervisor approval recorded on the linked Work Order covers this amount.','decided_by',wo.supervisor_approval_decided_by);
    END IF;
  END IF;
  IF e.approval_id IS NOT NULL THEN
    SELECT * INTO ap FROM public.approvals a WHERE a.id = e.approval_id AND a.status = 'approved' AND a.decided_at IS NOT NULL
      AND coalesce(a.amount,0) >= e.amount
      AND ((a.entity_type = 'expense' AND a.entity_id = e.id) OR (wo.id IS NOT NULL AND a.entity_type = 'work_order' AND a.entity_id = wo.id));
    IF ap.id IS NOT NULL AND ((who = 'owner' AND ap.approver_role = 'owner')
      OR (who = 'supervisor' AND private.can_approve_spending(ap.approver_id))) THEN
      RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','A linked approval by an authorized decision-maker covers this amount.','decided_by',CASE WHEN who='supervisor' THEN ap.approver_id END);
    END IF;
  END IF;
  RETURN jsonb_build_object('required',true,'ok',false,'who',who,
    'reason', CASE WHEN who = 'owner'
      THEN 'Owner approval covering this amount is not recorded on the linked Work Order. A written note does not count.'
      ELSE 'Approval by the Operations Supervisor or Director of Operations, covering this amount, is not recorded on the linked Work Order. A written note does not count.' END);
END $$;

-- Separation of duties: whoever recorded the internal spending approval cannot complete Finance review.
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
    IF auth.uid() IS NOT NULL AND (a->>'decided_by')::uuid = auth.uid() THEN
      RAISE EXCEPTION 'You approved this spending, so a different Finance reviewer must complete its Finance review';
    END IF;
  ELSIF OLD.finance_review = 'reviewed' AND NEW.finance_review = 'reviewed' AND private.expense_evidence_changed(OLD, NEW) THEN
    IF coalesce(btrim(NEW.change_reason),'') = '' THEN
      RAISE EXCEPTION 'This expense was reviewed by Finance. Give a reason for changing its required evidence';
    END IF;
    PERFORM set_config('resolve.evidence_reason', btrim(NEW.change_reason), true);
  END IF;
  RETURN NEW;
END $function$;

-- Narrow, audited, revocable demo lens for named real staff. Grants only the Demo view;
-- their existing seats/roles govern every action. No admin, seat or real-data change.
CREATE OR REPLACE FUNCTION private.is_demo_staff_tester(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.app_settings s
    WHERE s.key = 'demo_staff_accounts' AND jsonb_typeof(s.value) = 'array' AND s.value ? _uid::text)
    AND coalesce(public.is_internal_staff(_uid), false)
$$;

CREATE OR REPLACE FUNCTION public.set_demo_staff_access(_user uuid, _on boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _before jsonb; _after jsonb; _email text;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'admin'), false) THEN RAISE EXCEPTION 'Only an administrator can change demo staff access.'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give a reason for this change.'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user;
  IF _on AND NOT coalesce(public.is_internal_staff(_user), false) THEN RAISE EXCEPTION 'Demo staff access is only for internal staff.'; END IF;
  SELECT coalesce(value, '[]'::jsonb) INTO _before FROM app_settings WHERE key = 'demo_staff_accounts';
  _before := coalesce(_before, '[]'::jsonb);
  IF _on THEN _after := CASE WHEN _before ? _user::text THEN _before ELSE _before || to_jsonb(_user::text) END;
  ELSE _after := coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(_before) x WHERE x #>> '{}' <> _user::text), '[]'::jsonb);
  END IF;
  INSERT INTO app_settings(key, value, updated_by, updated_at) VALUES ('demo_staff_accounts', _after, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (auth.uid(), CASE WHEN _on THEN 'demo_staff_access_granted' ELSE 'demo_staff_access_revoked' END, 'user', _user, _email, trim(_reason), _before, _after);
END $$;
REVOKE ALL ON FUNCTION public.set_demo_staff_access(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_demo_staff_access(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_demo_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT jsonb_build_object(
    'admin', coalesce(public.has_role(auth.uid(), 'admin'), false),
    'finance_tester', private.is_demo_finance_tester(auth.uid()) OR private.is_demo_staff_tester(auth.uid()))
$$;