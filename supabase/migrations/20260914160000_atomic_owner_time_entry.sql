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
