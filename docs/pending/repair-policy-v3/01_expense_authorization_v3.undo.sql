-- Undo for 01_expense_authorization_v3.sql: restores the live definition captured Nov 8, 2026
-- (identical to drizzle/migrations/0133; md5 of body 2b00445066e5f2a3f4371230414a9b8e).
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
