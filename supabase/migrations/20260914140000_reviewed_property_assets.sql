-- Unapplied. Canonical equipment children; credentials remain in the secure store.
CREATE TABLE public.property_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL REFERENCES public.properties(id),
 name text NOT NULL CHECK(length(trim(name)) > 0), kind text NOT NULL,
 manufacturer text, model text, serial_number text, location text, warranty_notes text,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz, is_demo boolean NOT NULL DEFAULT false,
 UNIQUE(id,property_id)
);
ALTER TABLE public.property_assets ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.property_assets TO authenticated;
GRANT ALL ON public.property_assets TO service_role;
CREATE POLICY property_assets_staff_read ON public.property_assets FOR SELECT TO authenticated
 USING ((public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid())) AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id));
CREATE POLICY property_assets_staff_insert ON public.property_assets FOR INSERT TO authenticated
 WITH CHECK (public.is_onboarding_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id));
CREATE POLICY property_assets_staff_update ON public.property_assets FOR UPDATE TO authenticated
 USING (public.is_onboarding_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id))
 WITH CHECK (public.is_onboarding_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id));
ALTER TABLE public.property_fact_proposals ADD asset_id uuid;
ALTER TABLE public.property_fact_proposals ADD CONSTRAINT fact_proposal_asset_property_fk
 FOREIGN KEY(asset_id,property_id) REFERENCES public.property_assets(id,property_id);

CREATE OR REPLACE FUNCTION public.review_onboarding_fact(
  _proposal_id uuid, _accept boolean, _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  proposal public.property_fact_proposals%ROWTYPE;
  property_record public.properties%ROWTYPE;
  asset_record public.property_assets%ROWTYPE;
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
  IF proposal.asset_id IS NOT NULL THEN
    IF proposal.field_key NOT IN ('name','kind','manufacturer','model','serial_number','location','warranty_notes') THEN
      RAISE EXCEPTION 'This asset field cannot be changed through onboarding fact review.';
    END IF;
    SELECT * INTO asset_record FROM public.property_assets WHERE id=proposal.asset_id AND property_id=proposal.property_id AND archived_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'That asset is not available for this property.'; END IF;
    actual_value := to_jsonb(asset_record)->>proposal.field_key;
    IF _accept AND actual_value IS DISTINCT FROM proposal.current_value THEN RAISE EXCEPTION 'The asset changed after this proposal. Submit a new proposal.'; END IF;
    IF _accept THEN
      EXECUTE format('UPDATE public.property_assets SET %I=$1,updated_at=now() WHERE id=$2 AND property_id=$3',proposal.field_key)
        USING proposal.proposed_value,proposal.asset_id,proposal.property_id;
      GET DIAGNOSTICS changed=ROW_COUNT;
      IF changed <> 1 THEN RAISE EXCEPTION 'The asset could not be updated.'; END IF;
      SELECT * INTO asset_record FROM public.property_assets WHERE id=proposal.asset_id;
      IF (to_jsonb(asset_record)->>proposal.field_key) IS DISTINCT FROM proposal.proposed_value THEN RAISE EXCEPTION 'The asset could not be updated.'; END IF;
    END IF;
  ELSE
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
