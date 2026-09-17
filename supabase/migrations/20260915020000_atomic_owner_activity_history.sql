-- Unapplied. Preserve existing invoker security and EXECUTE grants.
-- Entry, property links and human-readable history must commit together.
-- Unapplied. One transaction for the reported activity and its enrolled homes.
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
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,previous_value,new_value,reason,detail)
 VALUES(original.program_id,new_id,original.review_id,'time_entry','Homeowner resubmitted a returned entry: ' || trim(_activity),auth.uid(),original.minutes::text,_minutes::text,trim(_note),
 jsonb_build_object('correctionOf',original.id,'propertyIds',coalesce((SELECT jsonb_agg(property_id ORDER BY property_id) FROM public.owner_time_entry_properties WHERE entry_id=new_id),'[]'::jsonb)));
 RETURN new_id;
END $$;
