-- Unapplied. Preserve every human reconciliation before releasing an uncertain claim.
ALTER TABLE public.approvals ADD COLUMN onboarding_delivery_history jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.financial_requests ADD COLUMN onboarding_delivery_history jsonb NOT NULL DEFAULT '[]';
CREATE FUNCTION public.reconcile_onboarding_delivery(_kind text,_record_id uuid,_attempt_id uuid,_delivered boolean,_note text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE target_table text; row_data jsonb; attempt jsonb; history jsonb; sent_field text; affected integer;
BEGIN
 IF _delivered IS NULL THEN RAISE EXCEPTION 'Choose a verified delivery outcome.'; END IF;
 IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN RAISE EXCEPTION 'Only onboarding staff can reconcile delivery.'; END IF;
 IF length(trim(coalesce(_note,''))) < 10 THEN RAISE EXCEPTION 'Record how delivery was verified, including the mailbox evidence.'; END IF;
 target_table := CASE _kind WHEN 'approval' THEN 'approvals' WHEN 'accounting' THEN 'financial_requests' END;
 IF target_table IS NULL THEN RAISE EXCEPTION 'Unsupported delivery record.'; END IF;
 sent_field := CASE _kind WHEN 'approval' THEN 'owner_email_sent_at' ELSE 'accounting_sent_at' END;
 EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 FOR UPDATE',target_table) INTO row_data USING _record_id;
 IF row_data IS NULL THEN RAISE EXCEPTION 'That delivery record is not available.'; END IF;
 attempt := row_data->'onboarding_delivery_attempt';
 IF attempt->>'id' IS DISTINCT FROM _attempt_id::text OR coalesce(attempt->>'state','sending') NOT IN ('uncertain','sent_unrecorded') THEN
  RAISE EXCEPTION 'The attempt changed or is still running. Refresh before reconciling.';
 END IF;
 IF row_data->>sent_field IS NOT NULL THEN RAISE EXCEPTION 'Delivery is already recorded.'; END IF;
 IF NOT _delivered AND attempt->>'state'='sent_unrecorded' THEN RAISE EXCEPTION 'The provider accepted this email. Record its delivery instead of retrying.'; END IF;
 IF _kind='accounting' AND row_data->>'status' <> 'invoiced' THEN RAISE EXCEPTION 'The accounting request changed. Review its status.'; END IF;
 history := coalesce(row_data->'onboarding_delivery_history','[]'::jsonb) || jsonb_build_array(attempt || jsonb_build_object('delivered',_delivered,'reconciledBy',auth.uid(),'reconciledAt',now(),'verification',trim(_note)));
 EXECUTE format('UPDATE public.%I SET onboarding_delivery_history=$1,onboarding_delivery_attempt=$2 WHERE id=$3',target_table)
 USING history,CASE WHEN _delivered THEN attempt || jsonb_build_object('state','confirmed_sent') ELSE NULL END,_record_id;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Delivery reconciliation could not be recorded.'; END IF;
 IF _delivered AND _kind='approval' THEN
  UPDATE public.approvals SET owner_email_to=attempt->>'recipient',owner_email_sent_at=(attempt->>'attemptedAt')::timestamptz,external_reference='email:' || (attempt->>'recipient') WHERE id=_record_id;
 ELSIF _delivered THEN
  UPDATE public.financial_requests SET accounting_recipient=attempt->>'recipient',accounting_sent_at=(attempt->>'attemptedAt')::timestamptz,status='sent_to_accounting',updated_at=now() WHERE id=_record_id;
 END IF;
 IF _delivered AND NOT FOUND THEN RAISE EXCEPTION 'The delivery receipt could not be recorded.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_onboarding_delivery(text,uuid,uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_onboarding_delivery(text,uuid,uuid,boolean,text) TO authenticated;

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

-- Unapplied: preserve the original entry and copy its historical property links atomically.
CREATE FUNCTION public.resubmit_owner_time_entry(_entry_id uuid,_minutes integer,_activity text,_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE original public.owner_time_entries%ROWTYPE; new_id uuid;
BEGIN
 -- Owners intentionally have no UPDATE policy on historical entries. Serialize
 -- correction calls without requiring permission to edit the original row.
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-time-correction:' || _entry_id::text,0));
 SELECT * INTO original FROM public.owner_time_entries WHERE id=_entry_id;
 IF NOT FOUND OR auth.uid() IS NULL OR original.owner_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'That entry is not available to you.'; END IF;
 IF original.review_status IS DISTINCT FROM 'returned' THEN RAISE EXCEPTION 'Only a returned entry can be corrected.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id=original.id) THEN RAISE EXCEPTION 'This entry has already been corrected and resubmitted.'; END IF;
 IF _minutes IS NULL OR _minutes < 1 OR _minutes > 1440 OR length(trim(coalesce(_activity,''))) < 3 OR length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Enter actual minutes, the activity, and a correction explanation.'; END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,output,decision_outcome,materials_reviewed,attachment_path,comments,review_id,ticket_id,amends_entry_id,correction_reason,review_status,attested,is_demo)
 VALUES(original.program_id,original.owner_user_id,original.phase,original.entry_date,_minutes,trim(_activity),original.activity_category,original.output,original.decision_outcome,original.materials_reviewed,original.attachment_path,trim(_note),original.review_id,original.ticket_id,original.id,trim(_note),'submitted',true,original.is_demo)
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id)
 SELECT new_id,property_id FROM public.owner_time_entry_properties WHERE entry_id=original.id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.resubmit_owner_time_entry(uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resubmit_owner_time_entry(uuid,integer,text,text) TO authenticated;

-- Unapplied. One transaction for the reported activity and its enrolled homes.
CREATE FUNCTION public.log_owner_time_entry(_entry jsonb,_property_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE program public.owner_programs%ROWTYPE; opportunity public.owner_reviews%ROWTYPE;
 entry_day date; reported_minutes integer; new_id uuid; chosen uuid[]; chosen_property uuid;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=(_entry->>'programId')::uuid;
 IF NOT FOUND OR auth.uid() IS NULL OR program.owner_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'That participation program is not available to you.'; END IF;
 IF coalesce(program.status,'') NOT IN ('active','target_reached') OR program.started_on IS NULL THEN RAISE EXCEPTION 'Activate this program before logging participation.'; END IF;
 entry_day := (_entry->>'entryDate')::date;
 reported_minutes := (_entry->>'minutes')::integer;
 IF entry_day IS NULL OR entry_day < program.started_on OR entry_day > current_date THEN RAISE EXCEPTION 'Choose a date from the program start through today.'; END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440 OR length(trim(coalesce(_entry->>'activity',''))) < 3 OR coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing') THEN RAISE EXCEPTION 'Enter the actual activity, phase, and minutes.'; END IF;
 SELECT * INTO opportunity FROM public.owner_reviews WHERE id=(_entry->>'reviewId')::uuid AND program_id=program.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a participation opportunity from this program.'; END IF;
 IF opportunity.status='closed' OR opportunity.available_from > now() THEN RAISE EXCEPTION 'That opportunity is not available.'; END IF;
 SELECT coalesce(array_agg(DISTINCT p),'{}'::uuid[]) INTO chosen FROM unnest(coalesce(_property_ids,'{}'::uuid[])) p;
 IF cardinality(chosen)=0 AND opportunity.task_type IS DISTINCT FROM 'multi_property' AND opportunity.property_id IS NOT NULL THEN chosen := ARRAY[opportunity.property_id]; END IF;
 IF opportunity.task_type='multi_property' AND cardinality(chosen)=0 THEN RAISE EXCEPTION 'Select the opportunity properties this activity involved.'; END IF;
 FOREACH chosen_property IN ARRAY chosen LOOP
  IF chosen_property IS NULL OR (opportunity.task_type IS DISTINCT FROM 'multi_property' AND opportunity.property_id IS NOT NULL AND chosen_property IS DISTINCT FROM opportunity.property_id) THEN RAISE EXCEPTION 'That opportunity belongs to a different property.'; END IF;
  IF opportunity.task_type='multi_property' AND NOT EXISTS(SELECT 1 FROM public.owner_review_properties r WHERE r.review_id=opportunity.id AND r.property_id=chosen_property) THEN RAISE EXCEPTION 'That property is not assigned to this participation opportunity.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.owner_program_properties l WHERE l.program_id=program.id AND l.property_id=chosen_property AND l.inclusion_status='included' AND l.closing_date IS NOT NULL AND l.closing_date<=entry_day) THEN RAISE EXCEPTION 'Participation requires an enrolled property and a post-closing date.'; END IF;
 END LOOP;
 IF nullif(_entry->>'ticketId','') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.tickets t WHERE t.id=(_entry->>'ticketId')::uuid AND t.property_id=ANY(chosen)
 ) THEN RAISE EXCEPTION 'Choose a visible ticket from one of the selected properties.'; END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,review_id,ticket_id,attested,is_demo)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),opportunity.id,nullif(_entry->>'ticketId','')::uuid,true,program.is_demo)
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.log_owner_time_entry(jsonb,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_owner_time_entry(jsonb,uuid[]) TO authenticated;