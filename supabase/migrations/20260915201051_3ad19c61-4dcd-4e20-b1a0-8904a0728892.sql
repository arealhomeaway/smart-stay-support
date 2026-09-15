-- Unapplied. Called only by the authenticated supervisor server action.
CREATE FUNCTION public.correct_owner_time_entry(_entry_id uuid,_actor_id uuid,_minutes integer,_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE original public.owner_time_entries%ROWTYPE; new_id uuid;
BEGIN
 IF _actor_id IS NULL OR NOT (coalesce(public.has_role(_actor_id,'admin'),false) OR coalesce(public.has_role(_actor_id,'manager'),false)) THEN RAISE EXCEPTION 'Only a supervisor can correct participation.'; END IF;
 IF _minutes IS NULL OR _minutes NOT BETWEEN 1 AND 1440 OR length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'Enter actual minutes and a correction reason.'; END IF;
 -- Use the same lock as owner resubmission to prevent competing amendments.
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-time-correction:' || _entry_id::text,0));
 SELECT * INTO original FROM public.owner_time_entries WHERE id=_entry_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That participation entry is not available.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id=original.id) THEN RAISE EXCEPTION 'This entry has already been corrected.'; END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,output,decision_outcome,materials_reviewed,attachment_path,comments,review_id,ticket_id,amends_entry_id,correction_reason,review_status,attested,is_demo)
 VALUES(original.program_id,original.owner_user_id,original.phase,original.entry_date,_minutes,original.activity,original.activity_category,original.output,original.decision_outcome,original.materials_reviewed,original.attachment_path,original.comments,original.review_id,original.ticket_id,original.id,trim(_reason),'submitted',original.attested,original.is_demo)
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,property_id FROM public.owner_time_entry_properties WHERE entry_id=original.id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,previous_value,new_value,reason,detail)
 VALUES(original.program_id,new_id,original.review_id,'time_corrected','Participation entry corrected by a supervisor.',_actor_id,original.minutes::text,_minutes::text,trim(_reason),jsonb_build_object('correctionOf',original.id));
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.correct_owner_time_entry(uuid,uuid,integer,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.correct_owner_time_entry(uuid,uuid,integer,text) TO service_role;

-- Unapplied. Store the generated participation report in the same update as closeout.
ALTER TABLE public.owner_programs ADD COLUMN completion_report jsonb;
COMMENT ON COLUMN public.owner_programs.completion_report IS 'Participation snapshot generated before formal closeout; preserves the report used for that decision.';

-- Unapplied. Server-only persistence after the authenticated readiness checks.
CREATE FUNCTION public.create_onboarding_handoff(_property_id uuid,_actor_id uuid,_expected_lifecycle text,_request jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE home public.properties%ROWTYPE; new_id uuid; open_ids uuid[]; task_id uuid; task public.onboarding_tasks%ROWTYPE;
BEGIN
 IF _actor_id IS NULL OR NOT coalesce(public.is_onboarding_staff(_actor_id),false) THEN RAISE EXCEPTION 'Only onboarding staff can request handoff.'; END IF;
 SELECT * INTO home FROM public.properties WHERE id=_property_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That property is not available.'; END IF;
 IF home.lifecycle_status IS DISTINCT FROM _expected_lifecycle OR home.handoff_accepted_at IS NOT NULL OR home.lifecycle_status IN ('handoff_requested','active_operations','offboarded') THEN RAISE EXCEPTION 'The property changed. Refresh its handoff readiness.'; END IF;
 IF EXISTS(SELECT 1 FROM public.property_handoffs WHERE property_id=home.id AND status IN ('requested','accepted_pending_live')) THEN RAISE EXCEPTION 'A handoff is already in review for this home.'; END IF;
 SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO open_ids FROM jsonb_array_elements_text(coalesce(_request->'openTaskIds','[]'::jsonb));
 IF cardinality(open_ids)>0 AND NOT coalesce((_request->>'carryoverAccepted')::boolean,false) THEN RAISE EXCEPTION 'Open handoff items require accepted carryover.'; END IF;
 FOR task_id IN SELECT DISTINCT unnest(open_ids) ORDER BY 1 LOOP
  SELECT * INTO task FROM public.onboarding_tasks WHERE id=task_id FOR UPDATE;
  IF NOT FOUND OR task.property_id IS DISTINCT FROM home.id OR task.archived_at IS NOT NULL OR task.assigned_to IS NULL OR task.due_on IS NULL OR length(trim(coalesce(task.carryover_reason,'')))=0 THEN
   RAISE EXCEPTION 'Carryover changed. Each item needs this property, an owner, due date, and reason.';
  END IF;
 END LOOP;
 INSERT INTO public.property_handoffs(property_id,status,requested_by,checklist,validation,open_task_ids,carryover_accepted,gate_step,notes,is_demo)
 VALUES(home.id,'requested',_actor_id,_request->'checklist',_request->'validation',open_ids,coalesce((_request->>'carryoverAccepted')::boolean,false),'kati_review',nullif(_request->>'notes',''),coalesce(home.is_demo,false))
 RETURNING id INTO new_id;
 UPDATE public.properties SET lifecycle_status='handoff_requested' WHERE id=home.id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) TO service_role;

-- Unapplied. Preserve existing invoker security and EXECUTE grants.
CREATE OR REPLACE FUNCTION public.log_owner_time_entry(_entry jsonb,_property_ids uuid[])
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
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text || ' minutes reported: ' || trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
 jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory'));
 RETURN new_id;
END $$;

-- Unapplied: preserve the original entry and copy its historical property links atomically.
CREATE OR REPLACE FUNCTION public.resubmit_owner_time_entry(_entry_id uuid,_minutes integer,_activity text,_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE original public.owner_time_entries%ROWTYPE; new_id uuid;
BEGIN
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
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,previous_value,new_value,reason,detail)
 VALUES(original.program_id,new_id,original.review_id,'time_entry','Homeowner resubmitted a returned entry: ' || trim(_activity),auth.uid(),original.minutes::text,_minutes::text,trim(_note),
 jsonb_build_object('correctionOf',original.id,'propertyIds',coalesce((SELECT jsonb_agg(property_id ORDER BY property_id) FROM public.owner_time_entry_properties WHERE entry_id=new_id),'[]'::jsonb)));
 RETURN new_id;
END $$;