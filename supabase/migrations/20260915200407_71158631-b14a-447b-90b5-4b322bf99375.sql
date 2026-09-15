-- Unapplied build migration. Reuses existing grants and RLS through SECURITY
-- INVOKER; does not change access to any existing table or role.
CREATE OR REPLACE FUNCTION public.review_onboarding_fact(
  _proposal_id uuid, _accept boolean, _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  proposal public.property_fact_proposals%ROWTYPE;
  property_record public.properties%ROWTYPE;
  actual_value text;
  decision text;
  changed integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have access to review onboarding facts.';
  END IF;
  SELECT * INTO proposal FROM public.property_fact_proposals
    WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That proposed change is not available.'; END IF;
  IF proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'That change has already been reviewed.';
  END IF;
  IF proposal.field_key NOT IN
    ('wifi_notes','access_notes','address_line1','city','state','postal_code','nickname') THEN
    RAISE EXCEPTION 'This field cannot be changed through onboarding fact review.';
  END IF;
  SELECT * INTO property_record FROM public.properties
    WHERE id = proposal.property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That property is not available.'; END IF;
  actual_value := to_jsonb(property_record) ->> proposal.field_key;
  IF _accept AND actual_value IS DISTINCT FROM proposal.current_value THEN
    RAISE EXCEPTION 'The property changed after this proposal. Review the current value and submit a new proposal.';
  END IF;
  IF _accept THEN
    EXECUTE format('UPDATE public.properties SET %I = $1 WHERE id = $2', proposal.field_key)
      USING proposal.proposed_value, proposal.property_id;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'The property could not be updated.'; END IF;
    SELECT * INTO property_record FROM public.properties WHERE id = proposal.property_id;
    IF (to_jsonb(property_record) ->> proposal.field_key) IS DISTINCT FROM proposal.proposed_value THEN
      RAISE EXCEPTION 'The property could not be updated.';
    END IF;
  END IF;
  decision := CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END;
  UPDATE public.property_fact_proposals SET status = decision,
    reviewed_by = auth.uid(), reviewed_at = now(), decision_note = _note
    WHERE id = proposal.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The review could not be recorded.'; END IF;
  IF proposal.project_id IS NOT NULL THEN
    INSERT INTO public.onboarding_project_events
      (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
    VALUES
      (proposal.project_id, proposal.property_id, 'fact_' || decision,
       proposal.field_label || ' — ' || decision, _note, actual_value,
       CASE WHEN _accept THEN proposal.proposed_value ELSE actual_value END,
       auth.uid(), proposal.is_demo);
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', decision);
END;
$$;
REVOKE ALL ON FUNCTION public.review_onboarding_fact(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_onboarding_fact(uuid, boolean, text) TO authenticated;

-- Unapplied. Stage captures are an append-only event stream in the existing
-- project history; the highest revision is the canonical record for a stage.
CREATE UNIQUE INDEX onboarding_stage_capture_revision_idx
  ON public.onboarding_project_events(project_id, kind, ((new_value::jsonb ->> 'revision')::integer))
  WHERE kind LIKE 'stage_capture:%';

CREATE FUNCTION public.protect_onboarding_stage_capture() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind LIKE 'stage_capture:%' AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Use the stage capture workflow to record a revision.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_onboarding_stage_capture BEFORE INSERT ON public.onboarding_project_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_stage_capture();

CREATE FUNCTION public.record_onboarding_stage_capture(
  _project_id uuid, _actor uuid, _expected_revision integer, _capture jsonb,
  _tasks jsonb, _scope jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  project public.onboarding_projects%ROWTYPE;
  actual_tasks jsonb;
  previous text;
  stage_key text := _capture ->> 'stage';
  actual_revision integer;
BEGIN
  IF NOT public.is_onboarding_staff(_actor) THEN RAISE EXCEPTION 'Stage capture requires onboarding staff.'; END IF;
  SELECT * INTO project FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding project is not available.'; END IF;
  IF jsonb_build_object('modules', project.modules, 'furnishing_scope', project.furnishing_scope, 'director', project.director)
     IS DISTINCT FROM _scope THEN RAISE EXCEPTION 'Project scope changed. Refresh before saving.'; END IF;
  PERFORM id FROM public.properties WHERE id = project.property_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.properties WHERE id = project.property_id AND
      (handoff_accepted_at IS NOT NULL OR lifecycle_status IN ('active_operations','handoff_requested')))
    THEN RAISE EXCEPTION 'The onboarding plan is locked for handoff.'; END IF;
  SELECT new_value INTO previous FROM public.onboarding_project_events
    WHERE project_id = _project_id AND kind = 'stage_capture:' || stage_key
    ORDER BY (new_value::jsonb ->> 'revision')::integer DESC LIMIT 1;
  actual_revision := coalesce((previous::jsonb ->> 'revision')::integer, 0);
  IF actual_revision <> _expected_revision OR (_capture ->> 'revision')::integer <> actual_revision + 1 THEN
    RAISE EXCEPTION 'This stage changed. Refresh before saving.';
  END IF;
  PERFORM id FROM public.onboarding_tasks WHERE property_id = project.property_id
    AND stage = stage_key AND archived_at IS NULL ORDER BY id FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) INTO actual_tasks
    FROM public.onboarding_tasks t WHERE property_id = project.property_id AND stage = stage_key AND archived_at IS NULL;
  IF actual_tasks IS DISTINCT FROM _tasks THEN RAISE EXCEPTION 'Stage work changed. Refresh before saving.'; END IF;
  IF _capture ->> 'status' IN ('complete','awaiting_review') AND EXISTS
    (SELECT 1 FROM public.property_fact_proposals WHERE property_id = project.property_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Permanent property facts await review.';
  END IF;
  INSERT INTO public.onboarding_project_events
    (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  VALUES (_project_id, project.property_id, 'stage_capture:' || stage_key,
    'Stage ' || stage_key || ': ' || (_capture ->> 'status') || ' (revision ' || (_capture ->> 'revision') || ')',
    _capture ->> 'reason', previous, _capture::text, _actor, project.is_demo);
END $$;
REVOKE ALL ON FUNCTION public.record_onboarding_stage_capture(uuid, uuid, integer, jsonb, jsonb, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_stage_capture(uuid, uuid, integer, jsonb, jsonb, jsonb) TO service_role;

CREATE VIEW public.onboarding_stage_captures WITH (security_invoker = true) AS
  SELECT DISTINCT ON (project_id, kind) project_id, property_id, new_value
  FROM public.onboarding_project_events WHERE kind LIKE 'stage_capture:%'
  ORDER BY project_id, kind, (new_value::jsonb ->> 'revision')::integer DESC;
GRANT SELECT ON public.onboarding_stage_captures TO authenticated, service_role;

-- Unapplied. Invoice and actual paid amount are distinct facts; no backfill
-- guesses that an invoice was paid, and no existing grants/RLS are changed.
ALTER TABLE public.financial_requests
  ADD COLUMN actual_amount numeric(12,2) CHECK (actual_amount >= 0),
  ADD COLUMN actual_recorded_at timestamptz,
  ADD COLUMN actual_recorded_by uuid;

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