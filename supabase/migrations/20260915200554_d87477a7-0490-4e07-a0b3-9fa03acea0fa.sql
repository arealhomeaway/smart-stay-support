-- Unapplied. A review and its property transition must commit together.
-- Existing table grants and RLS remain in force.
CREATE FUNCTION public.review_onboarding_handoff(
  _handoff_id uuid, _expected_step text, _decision text, _note text DEFAULT '', _exception text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE handoff public.property_handoffs%ROWTYPE; step_after text; status_after text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record a handoff review.'; END IF;
  SELECT * INTO handoff FROM public.property_handoffs WHERE id = _handoff_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That handoff is not available.'; END IF;
  IF handoff.status NOT IN ('requested','accepted_pending_live') THEN RAISE EXCEPTION 'This handoff was already closed.'; END IF;
  IF handoff.gate_step <> _expected_step THEN RAISE EXCEPTION 'The handoff advanced. Refresh before reviewing the next gate.'; END IF;
  IF NOT public.is_supervisor(auth.uid()) AND NOT (
    handoff.gate_step = 'kati_review' AND public.is_onboarding_staff(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.onboarding_projects WHERE property_id = handoff.property_id
      AND status <> 'cancelled' AND director = auth.uid()
    )) THEN RAISE EXCEPTION 'You do not have access to record this review step.'; END IF;
  IF _decision NOT IN ('accepted','returned') THEN RAISE EXCEPTION 'Invalid review decision.'; END IF;
  IF _decision = 'returned' AND length(trim(_note)) < 3 THEN RAISE EXCEPTION 'Record the corrections needed.'; END IF;
  PERFORM id FROM public.properties WHERE id = handoff.property_id FOR UPDATE;
  step_after := CASE handoff.gate_step WHEN 'kati_review' THEN 'micah_review'
    WHEN 'micah_review' THEN 'operations_acceptance' WHEN 'operations_acceptance' THEN 'live_confirmation'
    WHEN 'live_confirmation' THEN 'complete' ELSE NULL END;
  IF step_after IS NULL THEN RAISE EXCEPTION 'Invalid handoff gate.'; END IF;
  INSERT INTO public.handoff_reviews(handoff_id, property_id, step, decision, reviewer_id, note, exception_reason, is_demo)
    VALUES (handoff.id, handoff.property_id, handoff.gate_step, _decision, auth.uid(), nullif(_note,''), nullif(_exception,''), handoff.is_demo);
  IF _decision = 'returned' THEN
    UPDATE public.property_handoffs SET status = 'returned', reviewed_by = auth.uid(), reviewed_at = now(), corrections = _note WHERE id = handoff.id;
    UPDATE public.properties SET lifecycle_status = 'handoff_corrections', handoff_accepted_at = NULL WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The property correction state could not be recorded.'; END IF;
    RETURN jsonb_build_object('ok', true, 'step', handoff.gate_step, 'status', 'returned', 'propertyId', handoff.property_id);
  END IF;
  status_after := CASE handoff.gate_step WHEN 'operations_acceptance' THEN 'accepted_pending_live'
    WHEN 'live_confirmation' THEN 'accepted' ELSE 'requested' END;
  UPDATE public.property_handoffs SET gate_step = step_after, status = status_after,
    exceptions = CASE WHEN length(_exception) > 0 THEN coalesce(exceptions,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('step',handoff.gate_step,'reason',_exception,'by',auth.uid(),'at',now())) ELSE exceptions END,
    kati_reviewer = CASE WHEN handoff.gate_step = 'kati_review' THEN auth.uid() ELSE kati_reviewer END,
    kati_decision = CASE WHEN handoff.gate_step = 'kati_review' THEN 'approved' ELSE kati_decision END,
    kati_note = CASE WHEN handoff.gate_step = 'kati_review' THEN _note ELSE kati_note END,
    kati_at = CASE WHEN handoff.gate_step = 'kati_review' THEN now() ELSE kati_at END,
    micah_reviewer = CASE WHEN handoff.gate_step = 'micah_review' THEN auth.uid() ELSE micah_reviewer END,
    micah_decision = CASE WHEN handoff.gate_step = 'micah_review' THEN 'approved' ELSE micah_decision END,
    micah_note = CASE WHEN handoff.gate_step = 'micah_review' THEN _note ELSE micah_note END,
    micah_at = CASE WHEN handoff.gate_step = 'micah_review' THEN now() ELSE micah_at END,
    accepted_by = CASE WHEN handoff.gate_step = 'operations_acceptance' THEN auth.uid() ELSE accepted_by END,
    accepted_at = CASE WHEN handoff.gate_step = 'operations_acceptance' THEN now() ELSE accepted_at END,
    reviewed_by = auth.uid(), reviewed_at = now(),
    live_confirmed_by = CASE WHEN handoff.gate_step = 'live_confirmation' THEN auth.uid() ELSE live_confirmed_by END,
    live_confirmed_at = CASE WHEN handoff.gate_step = 'live_confirmation' THEN now() ELSE live_confirmed_at END
  WHERE id = handoff.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The handoff decision could not be recorded.'; END IF;
  IF handoff.gate_step = 'operations_acceptance' THEN
    UPDATE public.properties SET onboarding_stage = 'pending_live_confirmation', handoff_accepted_at = now() WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Operations acceptance could not be recorded.'; END IF;
    UPDATE public.onboarding_tasks SET status = 'carryover' WHERE property_id = handoff.property_id
      AND id = ANY(handoff.open_task_ids) AND status IN ('open','blocked');
  END IF;
  IF handoff.gate_step = 'live_confirmation' THEN
    UPDATE public.properties SET lifecycle_status = 'active_operations', active = true WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Live confirmation could not be recorded.'; END IF;
    UPDATE public.onboarding_projects SET status = 'complete', completed_at = now()
      WHERE property_id = handoff.property_id AND status <> 'cancelled';
  END IF;
  RETURN jsonb_build_object('ok', true, 'step', handoff.gate_step, 'status', status_after, 'propertyId', handoff.property_id);
END $$;
REVOKE ALL ON FUNCTION public.review_onboarding_handoff(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_onboarding_handoff(uuid, text, text, text, text) TO authenticated;

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

-- Unapplied. Existing requests keep their recorded tier; no policy is backfilled.
ALTER TABLE public.financial_requests ADD COLUMN authority_policy jsonb;
COMMENT ON COLUMN public.financial_requests.authority_policy IS
  'Approved policy version and thresholds captured when the request was created. Null means a legacy request; its recorded authority_tier remains authoritative.';

-- Unapplied: serialize approval preparation on the existing task row.
-- Existing authenticated table permissions and RLS remain in force.
CREATE FUNCTION public.prepare_onboarding_task_approval(
  _task_id uuid, _property_id uuid, _detail text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE task public.onboarding_tasks%ROWTYPE; approval_id uuid; pending_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have access to request this decision.';
  END IF;
  SELECT * INTO task FROM public.onboarding_tasks WHERE id = _task_id AND property_id = _property_id FOR UPDATE;
  IF NOT FOUND OR task.archived_at IS NOT NULL THEN RAISE EXCEPTION 'That task is not available for this property.'; END IF;
  IF NOT coalesce(task.requires_owner_approval,false) OR task.owner_approval_status = 'approved' THEN
    RAISE EXCEPTION 'This task does not need a new owner decision.';
  END IF;
  SELECT count(*) INTO pending_count FROM public.approvals
    WHERE entity_type = 'onboarding_task' AND entity_id = task.id AND property_id = task.property_id AND status = 'pending';
  IF pending_count > 1 THEN RAISE EXCEPTION 'Multiple pending decisions exist. Reconcile them before sending.'; END IF;
  SELECT id INTO approval_id FROM public.approvals
    WHERE entity_type = 'onboarding_task' AND entity_id = task.id AND property_id = task.property_id AND status = 'pending' FOR UPDATE;
  IF approval_id IS NULL THEN
    INSERT INTO public.approvals(entity_type,entity_id,property_id,kind,title,detail,requested_by,approver_role,status,due_on,is_demo)
      VALUES ('onboarding_task',task.id,task.property_id,'onboarding_task',task.title,nullif(_detail,''),auth.uid(),'owner','pending',task.due_on,task.is_demo)
      RETURNING id INTO approval_id;
  END IF;
  UPDATE public.onboarding_tasks SET owner_approval_status = 'awaiting_owner' WHERE id = task.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The approval could not be linked to its task.'; END IF;
  RETURN approval_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_onboarding_task_approval(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_onboarding_task_approval(uuid,uuid,text) TO authenticated;