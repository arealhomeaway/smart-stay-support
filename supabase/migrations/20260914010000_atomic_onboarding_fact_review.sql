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
