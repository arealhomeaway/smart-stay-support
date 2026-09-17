-- Unapplied. Reuse the canonical decision across delivery retries.
-- Caller permissions and existing table RLS remain in force.
CREATE FUNCTION public.prepare_onboarding_financial_approval(
  _request_id uuid, _expected_amount numeric, _expected_tier text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE request public.financial_requests%ROWTYPE; approval public.approvals%ROWTYPE; new_approval_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have access to request this decision.';
  END IF;
  SELECT * INTO request FROM public.financial_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That request is not available.'; END IF;
  IF request.status NOT IN ('estimate','awaiting_approval') OR request.approved_amount IS NOT NULL THEN
    RAISE EXCEPTION 'This request already has a decision. Create a new request for revised work.';
  END IF;
  IF request.estimate_amount IS DISTINCT FROM _expected_amount OR request.authority_tier IS DISTINCT FROM _expected_tier THEN
    RAISE EXCEPTION 'The request or its authority changed. Review the request before sending.';
  END IF;
  IF request.authority_tier NOT IN ('owner','supervisor') THEN
    RAISE EXCEPTION 'This request does not use the ordinary approval route.';
  END IF;
  IF request.approval_id IS NOT NULL THEN
    SELECT * INTO approval FROM public.approvals WHERE id = request.approval_id FOR UPDATE;
    IF NOT FOUND OR approval.property_id IS DISTINCT FROM request.property_id OR
      approval.entity_type IS DISTINCT FROM 'financial_request' OR approval.entity_id IS DISTINCT FROM request.id OR
      approval.status IS DISTINCT FROM 'pending' OR approval.amount IS DISTINCT FROM request.estimate_amount OR
      approval.approver_role IS DISTINCT FROM request.authority_tier THEN
      RAISE EXCEPTION 'The linked approval changed. Review it before retrying delivery.';
    END IF;
    RETURN approval.id;
  END IF;
  INSERT INTO public.approvals(entity_type,entity_id,property_id,kind,title,detail,amount,requested_by,approver_role,status,is_demo)
    VALUES ('financial_request',request.id,request.property_id,'onboarding_' || request.kind,request.title,
      concat_ws(E'\n',request.description,CASE WHEN request.vendor IS NOT NULL THEN 'Vendor: ' || request.vendor END),
      request.estimate_amount,auth.uid(),request.authority_tier,'pending',request.is_demo)
    RETURNING id INTO new_approval_id;
  UPDATE public.financial_requests SET approval_id = new_approval_id,
    status = 'awaiting_approval', updated_at = now() WHERE id = request.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The approval could not be linked to its request.'; END IF;
  RETURN new_approval_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_onboarding_financial_approval(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_onboarding_financial_approval(uuid, numeric, text) TO authenticated;
