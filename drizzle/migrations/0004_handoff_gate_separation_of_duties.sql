-- Four-gate handoff sequence: the project manager who submits a handoff can
-- never approve it, and one person cannot stand in for two different review
-- roles on the same handoff. Operations acceptance + Live confirmation are the
-- single legitimate pairing (both belong to the Operations Supervisor).
CREATE OR REPLACE FUNCTION public.review_onboarding_handoff(
  _handoff_id uuid, _expected_step text, _decision text, _note text DEFAULT '', _exception text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE handoff public.property_handoffs%ROWTYPE; step_after text; status_after text; home_id uuid; snapshot jsonb; expected_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record a handoff review.'; END IF;
  SELECT property_id INTO home_id FROM property_handoffs WHERE id=_handoff_id AND archived_at IS NULL;
  IF home_id IS NULL THEN RAISE EXCEPTION 'That handoff is not available.'; END IF;
  IF NOT private.onboarding_gate_reviewer(auth.uid(),_expected_step) THEN RAISE EXCEPTION 'You do not have responsibility for this review gate.'; END IF;
  PERFORM private.lock_onboarding_readiness(home_id);
  SELECT * INTO handoff FROM public.property_handoffs WHERE id = _handoff_id AND property_id=home_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That handoff is not available.'; END IF;
  IF handoff.status NOT IN ('requested','accepted_pending_live') THEN RAISE EXCEPTION 'This handoff was already closed.'; END IF;
  IF handoff.gate_step <> _expected_step THEN RAISE EXCEPTION 'The handoff advanced. Refresh before reviewing the next gate.'; END IF;
  IF NOT private.onboarding_gate_reviewer(auth.uid(),handoff.gate_step) THEN RAISE EXCEPTION 'Review responsibility changed. Refresh before deciding.'; END IF;

  -- Separation of duties.
  IF auth.uid() = handoff.requested_by THEN
    RAISE EXCEPTION 'The project manager who submitted this handoff cannot approve it.';
  END IF;
  IF EXISTS(SELECT 1 FROM onboarding_projects WHERE property_id=home_id AND status<>'cancelled' AND project_manager=auth.uid()) THEN
    RAISE EXCEPTION 'The project manager for this home cannot approve its own handoff.';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.handoff_reviews r
    WHERE r.handoff_id = handoff.id AND r.decision='accepted' AND r.reviewer_id = auth.uid()
      AND r.step <> handoff.gate_step
      AND NOT (r.step IN ('operations_acceptance','live_confirmation') AND handoff.gate_step IN ('operations_acceptance','live_confirmation'))
  ) THEN
    RAISE EXCEPTION 'Each handoff review role signs for itself — you already passed an earlier gate on this handoff.';
  END IF;

  IF handoff.is_demo IS DISTINCT FROM (SELECT is_demo FROM properties WHERE id=home_id) THEN RAISE EXCEPTION 'Handoff property context changed.'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('accepted','returned') THEN RAISE EXCEPTION 'Invalid review decision.'; END IF;
  IF _decision = 'returned' AND length(trim(_note)) < 3 THEN RAISE EXCEPTION 'Record the corrections needed.'; END IF;
  IF _decision='accepted' THEN
    IF EXISTS(SELECT 1 FROM properties WHERE id=home_id AND lifecycle_status<>'handoff_requested') OR EXISTS(
     SELECT 1 FROM onboarding_projects WHERE property_id=home_id AND status<>'cancelled' AND status NOT IN('planning','active','handoff')) THEN RAISE EXCEPTION 'The lifecycle changed. Return the handoff for corrections.'; END IF;
    snapshot:=private.onboarding_handoff_snapshot(home_id);
    expected_snapshot:=CASE WHEN handoff.gate_step='live_confirmation' THEN handoff.validation->'acceptedReadinessSnapshot' ELSE handoff.validation->'readinessSnapshot' END;
    IF expected_snapshot IS NULL OR private.comparable_onboarding_snapshot(snapshot) IS DISTINCT FROM private.comparable_onboarding_snapshot(expected_snapshot) THEN RAISE EXCEPTION 'The submitted readiness record changed. Return the handoff for corrections.'; END IF;
  END IF;
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
    UPDATE property_handoffs SET validation=coalesce(validation,'{}'::jsonb)||jsonb_build_object('acceptedReadinessSnapshot',private.onboarding_handoff_snapshot(home_id)) WHERE id=handoff.id;
  END IF;
  IF handoff.gate_step = 'live_confirmation' THEN
    UPDATE public.properties SET lifecycle_status = 'active_operations', active = true WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Live confirmation could not be recorded.'; END IF;
    UPDATE public.onboarding_projects SET status = 'complete', completed_at = now()
      WHERE property_id = handoff.property_id AND status <> 'cancelled';
  END IF;
  RETURN jsonb_build_object('ok', true, 'step', handoff.gate_step, 'status', status_after, 'propertyId', handoff.property_id);
END $fn$;