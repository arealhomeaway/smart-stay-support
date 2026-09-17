ALTER TABLE public.owner_time_entries
 ADD COLUMN owner_update_revision integer,
 ADD COLUMN owner_update_snapshot jsonb,
 ADD CONSTRAINT owner_time_reviewed_update_fk FOREIGN KEY(ticket_id,owner_update_revision) REFERENCES public.ticket_owner_updates(ticket_id,revision),
 ADD CONSTRAINT owner_time_reviewed_update_ticket CHECK(owner_update_revision IS NULL OR ticket_id IS NOT NULL);

-- The snapshot is derived here, never accepted from browser text. Corrections inherit it.
CREATE FUNCTION public.capture_owner_time_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original public.owner_time_entries; p public.owner_programs; u public.ticket_owner_updates;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.owner_update_revision IS DISTINCT FROM OLD.owner_update_revision OR NEW.owner_update_snapshot IS DISTINCT FROM OLD.owner_update_snapshot
   OR (OLD.owner_update_revision IS NOT NULL AND (NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.review_id IS DISTINCT FROM OLD.review_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo)) THEN
   RAISE EXCEPTION 'The reviewed owner update is immutable. Preserve it through a correction.';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.amends_entry_id IS NOT NULL THEN
  SELECT * INTO original FROM public.owner_time_entries WHERE id=NEW.amends_entry_id;
  IF NOT FOUND OR NEW.program_id IS DISTINCT FROM original.program_id OR NEW.owner_user_id IS DISTINCT FROM original.owner_user_id
   OR NEW.ticket_id IS DISTINCT FROM original.ticket_id OR NEW.review_id IS DISTINCT FROM original.review_id OR NEW.is_demo IS DISTINCT FROM original.is_demo THEN
   RAISE EXCEPTION 'A correction must preserve the original participation context.';
  END IF;
  NEW.owner_update_revision:=original.owner_update_revision;
  NEW.owner_update_snapshot:=original.owner_update_snapshot;
  RETURN NEW;
 END IF;
 NEW.owner_update_snapshot:=NULL;
 IF NEW.owner_update_revision IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.owner_programs WHERE id=NEW.program_id FOR UPDATE;
 IF NOT FOUND OR p.owner_user_id IS DISTINCT FROM NEW.owner_user_id OR p.owner_record_id IS NULL OR p.archived_at IS NOT NULL
  OR p.is_demo IS DISTINCT FROM NEW.is_demo OR p.status NOT IN ('active','target_reached') THEN RAISE EXCEPTION 'The reviewed update program is no longer eligible.'; END IF;
 SELECT * INTO u FROM public.ticket_owner_updates WHERE ticket_id=NEW.ticket_id AND revision=NEW.owner_update_revision;
 IF NOT FOUND OR u.owner_record_id IS DISTINCT FROM p.owner_record_id OR u.is_demo IS DISTINCT FROM p.is_demo OR NEW.entry_date < u.reviewed_at::date THEN
  RAISE EXCEPTION 'Choose the owner update you reviewed on this participation date.';
 END IF;
 PERFORM 1 FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id
  WHERE h.id=u.property_id AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo AND e.program_id=p.id AND e.inclusion_status='included' FOR SHARE OF h,e;
 IF NOT FOUND THEN RAISE EXCEPTION 'The reviewed update Property is no longer included for this Owner.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=p.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is inactive.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_reviews r WHERE r.id=NEW.review_id AND r.program_id=p.id AND r.ticket_id=u.ticket_id)
 OR NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=u.ticket_id AND t.property_id=u.property_id AND t.is_demo=p.is_demo) THEN
  RAISE EXCEPTION 'The reviewed update does not match this opportunity and Ticket.';
 END IF;
 NEW.owner_update_snapshot:=jsonb_build_object('revision',u.revision,'issue',u.issue,'work_performed',u.work_performed,'outcome',u.outcome,'reviewed_at',u.reviewed_at);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_owner_time_update() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_owner_time_update BEFORE INSERT OR UPDATE ON public.owner_time_entries FOR EACH ROW EXECUTE FUNCTION public.capture_owner_time_update();
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
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,review_id,ticket_id,attested,is_demo,owner_update_revision)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),opportunity.id,nullif(_entry->>'ticketId','')::uuid,true,program.is_demo,nullif(_entry->>'ownerUpdateRevision','')::integer)
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text || ' minutes reported: ' || trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
 jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory'));
 RETURN new_id;
END $$;
