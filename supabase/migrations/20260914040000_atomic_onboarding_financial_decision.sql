-- Unapplied. Record the canonical approval, financial decision and project
-- history atomically, using the caller's existing grants and RLS.
CREATE FUNCTION public.decide_onboarding_financial_request(
  _request_id uuid, _approved boolean, _note text, _approved_amount numeric DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE request public.financial_requests%ROWTYPE; amount numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have access to record this decision.';
  END IF;
  IF length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Record who decided and what they said.'; END IF;
  SELECT * INTO request FROM public.financial_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That request is not available.'; END IF;
  IF request.status NOT IN ('estimate','awaiting_approval') OR request.approved_amount IS NOT NULL THEN
    RAISE EXCEPTION 'This request already has a decision. Preserve it and create a new request for a revised amount.';
  END IF;
  amount := CASE WHEN _approved THEN coalesce(_approved_amount, request.estimate_amount) ELSE NULL END;
  IF _approved AND (amount IS NULL OR amount < 0 OR amount > 1000000) THEN RAISE EXCEPTION 'Enter a valid approved amount.'; END IF;
  IF request.approval_id IS NOT NULL THEN
    UPDATE public.approvals SET status = CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
      decision_note = _note, decided_at = now()
    WHERE id = request.approval_id AND property_id = request.property_id
      AND entity_type = 'financial_request' AND entity_id = request.id AND status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'The linked approval changed. Refresh before recording the decision.'; END IF;
  END IF;
  UPDATE public.financial_requests SET status = CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
    approved_amount = amount, approved_at = CASE WHEN _approved THEN now() ELSE NULL END, updated_at = now()
    WHERE id = request.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The financial decision could not be recorded.'; END IF;
  IF request.project_id IS NOT NULL THEN
    INSERT INTO public.onboarding_project_events
      (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
    VALUES (request.project_id, request.property_id, 'financial_decision',
      request.title || ' — ' || CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
      _note, request.approved_amount::text, amount::text, auth.uid(), request.is_demo);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.decide_onboarding_financial_request(uuid, boolean, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_onboarding_financial_request(uuid, boolean, text, numeric) TO authenticated;
