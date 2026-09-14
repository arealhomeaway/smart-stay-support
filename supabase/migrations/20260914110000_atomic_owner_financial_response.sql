-- Unapplied: the existing owner response endpoint calls this after its RLS/recipient check.
CREATE FUNCTION public.record_owner_financial_response(
 _approval_id uuid, _owner_id uuid, _approved boolean, _note text
) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE approval public.approvals%ROWTYPE; request public.financial_requests%ROWTYPE; decided timestamptz := now(); amount numeric;
BEGIN
 SELECT * INTO approval FROM public.approvals WHERE id=_approval_id;
 IF NOT FOUND OR approval.entity_type IS DISTINCT FROM 'financial_request' OR approval.approver_id IS DISTINCT FROM _owner_id OR _owner_id IS NULL THEN
  RAISE EXCEPTION 'That financial approval is not addressed to this owner.';
 END IF;
 SELECT * INTO request FROM public.financial_requests WHERE id=approval.entity_id AND property_id=approval.property_id FOR UPDATE;
 IF NOT FOUND OR request.status IS DISTINCT FROM 'awaiting_approval' OR request.approval_id IS DISTINCT FROM _approval_id OR request.approved_amount IS NOT NULL THEN
  RAISE EXCEPTION 'That financial request no longer accepts a response.';
 END IF;
 SELECT * INTO approval FROM public.approvals WHERE id=_approval_id FOR UPDATE;
 IF approval.status IS DISTINCT FROM 'pending' OR approval.approver_id IS DISTINCT FROM _owner_id OR approval.approver_role IS DISTINCT FROM 'owner' OR approval.entity_type IS DISTINCT FROM 'financial_request' OR approval.entity_id IS DISTINCT FROM request.id OR approval.property_id IS DISTINCT FROM request.property_id THEN
  RAISE EXCEPTION 'The approval changed. Refresh before responding.';
 END IF;
 IF approval.amount IS DISTINCT FROM request.estimate_amount OR approval.amount IS NULL OR approval.amount < 0 OR approval.amount > 1000000 THEN
  RAISE EXCEPTION 'The requested amount changed. Ask the team to prepare a new approval.';
 END IF;
 IF NOT _approved AND length(trim(coalesce(_note,'')))=0 THEN RAISE EXCEPTION 'Explain what you would like changed.'; END IF;
 amount := CASE WHEN _approved THEN approval.amount ELSE NULL END;
 UPDATE public.approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END, decision_note=nullif(trim(_note),''),decided_at=decided WHERE id=_approval_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The response could not be recorded.'; END IF;
 UPDATE public.financial_requests SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
 approved_amount=amount, approved_at=CASE WHEN _approved THEN decided ELSE NULL END, updated_at=decided WHERE id=request.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The financial response could not be recorded.'; END IF;
 IF request.project_id IS NOT NULL THEN
  INSERT INTO public.onboarding_project_events(project_id,property_id,kind,summary,detail,prior_value,new_value,actor,is_demo)
  VALUES(request.project_id,request.property_id,'financial_decision',request.title || ' — ' || CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
   _note,request.approved_amount::text,amount::text,_owner_id,request.is_demo);
 END IF;
 RETURN decided;
END $$;
REVOKE ALL ON FUNCTION public.record_owner_financial_response(uuid,uuid,boolean,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.record_owner_financial_response(uuid,uuid,boolean,text) TO service_role;
