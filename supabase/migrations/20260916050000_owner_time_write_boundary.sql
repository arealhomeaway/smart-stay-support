-- One transaction boundary for time, corrections and staff review. Existing
-- evidence is retained; new participation requires current canonical eligibility.
ALTER TABLE public.owner_time_entries ADD COLUMN review_version uuid NOT NULL DEFAULT gen_random_uuid();

CREATE FUNCTION private.lock_owner_time_program(_program_id uuid,_actor_id uuid,_staff boolean,_new_activity boolean)
RETURNS public.owner_programs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _actor_id IS NULL OR program.archived_at IS NOT NULL OR program.completed_at IS NOT NULL
  OR program.started_on IS NULL OR NOT isfinite(program.started_on)
  OR (_new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached'))
  OR (NOT _new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','paused')) THEN
  RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;
 IF _staff THEN
  IF NOT (coalesce(public.has_role(_actor_id,'admin'),false) OR coalesce(public.has_role(_actor_id,'manager'),false))
   OR (program.is_demo AND NOT coalesce(public.has_role(_actor_id,'admin'),false)) THEN
   RAISE EXCEPTION 'Only an authorized supervisor can review or correct participation.';
  END IF;
 ELSE
  PERFORM 1 FROM public.user_roles WHERE user_id=_actor_id FOR SHARE NOWAIT;
  IF program.owner_user_id IS DISTINCT FROM _actor_id OR program.is_demo
   OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text='owner')
   OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text<>'owner') THEN
   RAISE EXCEPTION 'That participation program is not available to you.';
  END IF;
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participation requires an active canonical Owner.'; END IF;
 RETURN program;
END $$;
REVOKE ALL ON FUNCTION private.lock_owner_time_program(uuid,uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.log_owner_time_entry(_entry jsonb,_property_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs; opportunity public.owner_reviews; enrollment public.owner_program_properties;
 home public.properties; link record; chosen uuid[]; context_ids uuid[]; chosen_property uuid;
 entry_day date; reported_minutes integer; new_id uuid; ticket public.tickets;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record participation.'; END IF;
 IF _entry IS NULL OR jsonb_typeof(_entry) IS DISTINCT FROM 'object' OR (_entry->'confirmed') IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'Confirm that this entry records the time you personally spent.';
 END IF;
 program:=private.lock_owner_time_program((_entry->>'programId')::uuid,auth.uid(),false,true);
 entry_day:=(_entry->>'entryDate')::date; reported_minutes:=(_entry->>'minutes')::integer;
 IF entry_day IS NULL OR NOT isfinite(entry_day) OR entry_day<program.started_on OR entry_day>current_date THEN
  RAISE EXCEPTION 'Choose a date from the program start through today.';
 END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440
  OR length(trim(coalesce(_entry->>'activity',''))) NOT BETWEEN 3 AND 500
  OR coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing')
  OR length(coalesce(_entry->>'activityCategory',''))>80 OR length(coalesce(_entry->>'output',''))>1000
  OR length(coalesce(_entry->>'comments',''))>1000 OR length(coalesce(_entry->>'attachmentPath',''))>400 THEN
  RAISE EXCEPTION 'Enter the actual activity, phase and minutes within the allowed limits.';
 END IF;
 SELECT * INTO opportunity FROM public.owner_reviews WHERE id=(_entry->>'reviewId')::uuid AND program_id=program.id FOR SHARE NOWAIT;
 IF NOT FOUND OR opportunity.archived_at IS NOT NULL OR opportunity.is_demo IS DISTINCT FROM program.is_demo
  OR coalesce(opportunity.status,'') NOT IN ('awaiting_owner','answered','returned') OR opportunity.available_from>now() OR opportunity.available_from::date>entry_day
  OR opportunity.phase IS DISTINCT FROM (_entry->>'phase') THEN
  RAISE EXCEPTION 'Choose an available participation opportunity from this program.';
 END IF;
 IF opportunity.task_type NOT IN ('property_specific','multi_property','program_wide') OR opportunity.task_type IS NULL THEN
  RAISE EXCEPTION 'This opportunity needs a valid participation scope.';
 END IF;
 IF cardinality(coalesce(_property_ids,'{}'::uuid[]))>25 OR array_position(_property_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Choose at most 25 valid opportunity properties.';
 END IF;
 SELECT coalesce(array_agg(DISTINCT p ORDER BY p),'{}'::uuid[]) INTO chosen FROM unnest(coalesce(_property_ids,'{}'::uuid[])) p;
 IF opportunity.task_type='property_specific' THEN
  IF opportunity.property_id IS NULL THEN RAISE EXCEPTION 'This opportunity needs its canonical Property.'; END IF;
  IF cardinality(chosen)=0 THEN chosen:=ARRAY[opportunity.property_id]; END IF;
  IF chosen IS DISTINCT FROM ARRAY[opportunity.property_id] THEN RAISE EXCEPTION 'That opportunity belongs to a different Property.'; END IF;
 ELSIF opportunity.task_type='multi_property' AND cardinality(chosen)=0 THEN
  RAISE EXCEPTION 'Select the opportunity properties this activity involved.';
 ELSIF opportunity.task_type='program_wide' AND opportunity.property_id IS NOT NULL THEN
  RAISE EXCEPTION 'The program-wide opportunity has conflicting Property context.';
 END IF;
 context_ids:=chosen;
 IF opportunity.property_id IS NOT NULL THEN context_ids:=array_append(context_ids,opportunity.property_id); END IF;
 FOR link IN SELECT r.property_id FROM public.owner_review_properties r WHERE r.review_id=opportunity.id ORDER BY r.property_id FOR SHARE NOWAIT LOOP
  context_ids:=array_append(context_ids,link.property_id);
  IF opportunity.task_type='property_specific' AND link.property_id IS DISTINCT FROM opportunity.property_id THEN
   RAISE EXCEPTION 'The opportunity Property links changed. Ask the team to reconcile them.';
  END IF;
 END LOOP;
 IF opportunity.task_type='multi_property' AND EXISTS(SELECT 1 FROM unnest(chosen) p WHERE NOT EXISTS(
  SELECT 1 FROM public.owner_review_properties r WHERE r.review_id=opportunity.id AND r.property_id=p
 )) THEN RAISE EXCEPTION 'That Property is not assigned to this participation opportunity.'; END IF;
 -- A program-wide activity may have no Property links, but must still have a
 -- current post-closing enrollment; do not fabricate links to every home.
 IF cardinality(chosen)=0 THEN
  SELECT e.property_id INTO chosen_property FROM public.owner_program_properties e
  JOIN public.properties h ON h.id=e.property_id
  WHERE e.program_id=program.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=program.is_demo
   AND e.closing_confirmed AND e.closing_date<=entry_day AND h.owner_record_id=program.owner_record_id
   AND h.archived_at IS NULL AND h.is_demo=program.is_demo ORDER BY e.property_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participation requires a current post-closing enrollment.'; END IF;
  context_ids:=array_append(context_ids,chosen_property);
 END IF;
 FOR chosen_property IN SELECT DISTINCT p FROM unnest(context_ids) p ORDER BY p LOOP
  SELECT * INTO enrollment FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.property_id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR enrollment.inclusion_status IS DISTINCT FROM 'included' OR enrollment.archived_at IS NOT NULL
   OR enrollment.is_demo IS DISTINCT FROM program.is_demo OR NOT coalesce(enrollment.closing_confirmed,false)
   OR enrollment.closing_date IS NULL OR NOT isfinite(enrollment.closing_date)
   OR (chosen_property=ANY(chosen) AND enrollment.closing_date>entry_day) THEN
   RAISE EXCEPTION 'Participation requires current enrollment and a confirmed post-closing date.';
  END IF;
  SELECT * INTO home FROM public.properties h WHERE h.id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.archived_at IS NOT NULL
   OR home.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The opportunity Property is no longer available to this Owner.'; END IF;
 END LOOP;
 IF nullif(_entry->>'ticketId','')::uuid IS DISTINCT FROM opportunity.ticket_id THEN
  RAISE EXCEPTION 'Time must retain its participation opportunity Ticket link.';
 END IF;
 IF opportunity.ticket_id IS NOT NULL THEN
  SELECT * INTO ticket FROM public.tickets WHERE id=opportunity.ticket_id FOR SHARE NOWAIT;
  IF NOT FOUND OR ticket.property_id IS DISTINCT FROM opportunity.property_id OR NOT ticket.property_id=ANY(chosen)
   OR ticket.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The opportunity Ticket context changed.'; END IF;
 END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,review_id,ticket_id,attested,is_demo,owner_update_revision,review_status)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),opportunity.id,opportunity.ticket_id,true,program.is_demo,nullif(_entry->>'ownerUpdateRevision','')::integer,'submitted')
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
 UPDATE public.owner_program_properties e SET last_owner_activity_at=now() WHERE e.program_id=program.id AND e.property_id=ANY(chosen);
 UPDATE public.owner_programs SET last_owner_activity_at=now() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text||' minutes reported: '||trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
  jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory'));
 RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or opportunity is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.log_owner_time_entry(jsonb,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.log_owner_time_entry(jsonb,uuid[]) TO authenticated;

-- All corrections preserve original identity, date, opportunity, evidence and links,
-- even after the Property leaves enrollment. Closed report inputs cannot be changed.
CREATE OR REPLACE FUNCTION public.resubmit_owner_time_entry(_entry_id uuid,_minutes integer,_activity text,_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original public.owner_time_entries; program public.owner_programs; scope uuid; new_id uuid;
BEGIN
 SELECT program_id INTO scope FROM public.owner_time_entries WHERE id=_entry_id AND owner_user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'That entry is not available to you.'; END IF;
 program:=private.lock_owner_time_program(scope,auth.uid(),false,false);
 IF NOT pg_try_advisory_xact_lock(hashtextextended('owner-time-correction:'||_entry_id::text,0)) THEN
  RAISE EXCEPTION 'This entry is being corrected. Refresh and try again.';
 END IF;
 SELECT * INTO original FROM public.owner_time_entries WHERE id=_entry_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR original.program_id IS DISTINCT FROM program.id OR original.owner_user_id IS DISTINCT FROM auth.uid()
  OR original.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The participation context changed.'; END IF;
 IF original.review_status IS DISTINCT FROM 'returned' THEN RAISE EXCEPTION 'Only a returned entry can be corrected.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id=original.id) THEN RAISE EXCEPTION 'This entry has already been corrected and resubmitted.'; END IF;
 IF _minutes IS NULL OR _minutes NOT BETWEEN 1 AND 1440 OR length(trim(coalesce(_activity,''))) NOT BETWEEN 3 AND 500
  OR length(trim(coalesce(_note,''))) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Enter actual minutes, the activity and a correction explanation.'; END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,output,decision_outcome,materials_reviewed,attachment_path,comments,review_id,ticket_id,amends_entry_id,correction_reason,review_status,attested,is_demo)
 VALUES(original.program_id,original.owner_user_id,original.phase,original.entry_date,_minutes,trim(_activity),original.activity_category,original.output,original.decision_outcome,original.materials_reviewed,original.attachment_path,trim(_note),original.review_id,original.ticket_id,original.id,trim(_note),'submitted',true,original.is_demo)
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,property_id FROM public.owner_time_entry_properties WHERE entry_id=original.id ORDER BY property_id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,previous_value,new_value,reason,detail)
 VALUES(program.id,new_id,original.review_id,'time_entry','Homeowner resubmitted a returned entry: '||trim(_activity),auth.uid(),original.minutes::text,_minutes::text,trim(_note),
  jsonb_build_object('correctionOf',original.id,'propertyIds',coalesce((SELECT jsonb_agg(property_id ORDER BY property_id) FROM public.owner_time_entry_properties WHERE entry_id=new_id),'[]'::jsonb)));
 RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or entry is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.resubmit_owner_time_entry(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resubmit_owner_time_entry(uuid,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.correct_owner_time_entry(_entry_id uuid,_actor_id uuid,_minutes integer,_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original public.owner_time_entries; program public.owner_programs; scope uuid; new_id uuid;
BEGIN
 SELECT program_id INTO scope FROM public.owner_time_entries WHERE id=_entry_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'That participation entry is not available.'; END IF;
 program:=private.lock_owner_time_program(scope,_actor_id,true,false);
 IF NOT pg_try_advisory_xact_lock(hashtextextended('owner-time-correction:'||_entry_id::text,0)) THEN
  RAISE EXCEPTION 'This entry is being corrected. Refresh and try again.';
 END IF;
 SELECT * INTO original FROM public.owner_time_entries WHERE id=_entry_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR original.program_id IS DISTINCT FROM program.id OR original.is_demo IS DISTINCT FROM program.is_demo
  OR original.owner_user_id IS DISTINCT FROM program.owner_user_id THEN RAISE EXCEPTION 'The participation context changed.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id=original.id) THEN RAISE EXCEPTION 'This entry has already been corrected.'; END IF;
 IF _minutes IS NULL OR _minutes NOT BETWEEN 1 AND 1440 OR length(trim(coalesce(_reason,''))) NOT BETWEEN 3 AND 1000 THEN
  RAISE EXCEPTION 'Enter actual minutes and a correction reason.';
 END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,output,decision_outcome,materials_reviewed,attachment_path,comments,review_id,ticket_id,amends_entry_id,correction_reason,review_status,attested,is_demo)
 VALUES(original.program_id,original.owner_user_id,original.phase,original.entry_date,_minutes,original.activity,original.activity_category,original.output,original.decision_outcome,original.materials_reviewed,original.attachment_path,original.comments,original.review_id,original.ticket_id,original.id,trim(_reason),'submitted',original.attested,original.is_demo)
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,property_id FROM public.owner_time_entry_properties WHERE entry_id=original.id ORDER BY property_id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,previous_value,new_value,reason,detail)
 VALUES(program.id,new_id,original.review_id,'time_corrected','Participation entry corrected by a supervisor.',_actor_id,original.minutes::text,_minutes::text,trim(_reason),jsonb_build_object('correctionOf',original.id));
 RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or entry is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.correct_owner_time_entry(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.correct_owner_time_entry(uuid,uuid,integer,text) TO service_role;

CREATE FUNCTION public.review_owner_time_entry(_entry_id uuid,_expected_version uuid,_decision text,_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original public.owner_time_entries; program public.owner_programs; scope uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'manager'),false)) THEN
  RAISE EXCEPTION 'Only an authorized supervisor can review participation.';
 END IF;
 IF _decision IS NULL OR _decision NOT IN ('approved','returned','flagged') OR length(coalesce(_note,''))>1000
  OR (_decision<>'approved' AND length(trim(coalesce(_note,'')))=0) THEN
  RAISE EXCEPTION 'Choose a review decision and give a reason for a return or flag.';
 END IF;
 SELECT program_id INTO scope FROM public.owner_time_entries WHERE id=_entry_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'That participation entry is not available.'; END IF;
 program:=private.lock_owner_time_program(scope,auth.uid(),true,false);
 SELECT * INTO original FROM public.owner_time_entries WHERE id=_entry_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR original.program_id IS DISTINCT FROM program.id OR original.is_demo IS DISTINCT FROM program.is_demo
  OR original.owner_user_id IS DISTINCT FROM program.owner_user_id THEN RAISE EXCEPTION 'The participation context changed.'; END IF;
 IF _expected_version IS NULL OR original.review_version IS DISTINCT FROM _expected_version THEN
  RAISE EXCEPTION 'The entry review changed. Review the current entry before deciding.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id=original.id) THEN
  RAISE EXCEPTION 'This entry was superseded by a correction. Review the current entry.';
 END IF;
 UPDATE public.owner_time_entries SET review_status=_decision,review_note=nullif(trim(_note),''),
  reviewed_by=auth.uid(),reviewed_at=now(),flagged=(_decision='flagged') WHERE id=original.id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,previous_value,new_value,reason,detail)
 VALUES(program.id,original.id,original.review_id,'time_entry_reviewed','Participation entry reviewed.',auth.uid(),original.review_status,_decision,nullif(trim(_note),''),
  jsonb_build_object('reviewedVersion',_expected_version));
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value)
 VALUES(auth.uid(),'owner_time_entry_'||_decision,'owner_time_entry',original.id,nullif(trim(_note),''),
  jsonb_build_object('review_status',original.review_status,'review_version',original.review_version),
  jsonb_build_object('review_status',_decision));
 RETURN original.id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or entry is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.review_owner_time_entry(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_owner_time_entry(uuid,uuid,text,text) TO authenticated,service_role;

-- Replaced functions retain their original owners. Refuse an incompatible target
-- before dropping policies: every writer must enter the same trusted DB role.
DO $$
DECLARE trusted oid;
BEGIN
 SELECT proowner INTO trusted FROM pg_proc WHERE oid='public.log_owner_time_entry(jsonb,uuid[])'::regprocedure;
 IF pg_get_userbyid(trusted) IN ('anon','authenticated','service_role') OR EXISTS(
  SELECT 1 FROM pg_proc WHERE oid IN (
   'public.log_owner_time_entry(jsonb,uuid[])'::regprocedure,
   'public.resubmit_owner_time_entry(uuid,integer,text,text)'::regprocedure,
   'public.correct_owner_time_entry(uuid,uuid,integer,text)'::regprocedure,
   'public.review_owner_time_entry(uuid,uuid,text,text)'::regprocedure
  ) AND (proowner<>trusted OR NOT prosecdef)
 ) THEN RAISE EXCEPTION 'Participation writers need the same trusted non-application function owner before this migration can apply.';
 END IF;
END $$;
-- Checked writers using the trusted database role may create time/history or change review metadata.
-- Core evidence and historical Property links cannot be rewritten in place.
CREATE FUNCTION public.guard_owner_time_write() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE trusted name; mutable text[]:=ARRAY['review_status','review_note','reviewed_by','reviewed_at','flagged','review_version'];
BEGIN
 SELECT pg_get_userbyid(proowner) INTO trusted FROM pg_proc WHERE oid='public.log_owner_time_entry(jsonb,uuid[])'::regprocedure;
 IF TG_TABLE_NAME='owner_time_entries' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Participation evidence is immutable. Record a correction instead.'; END IF;
  IF TG_OP='UPDATE' THEN
   IF (to_jsonb(NEW)-mutable) IS DISTINCT FROM (to_jsonb(OLD)-mutable) THEN
    RAISE EXCEPTION 'Participation evidence is immutable. Record a correction instead.';
   END IF;
   IF current_user IS DISTINCT FROM trusted THEN RAISE EXCEPTION 'Review participation through its atomic review action.'; END IF;
   NEW.review_version:=gen_random_uuid();
  ELSIF current_user IS DISTINCT FROM trusted THEN
   RAISE EXCEPTION 'Record participation through its atomic logging or correction action.';
  END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='owner_time_entry_properties' THEN
  IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Historical participation Property links are immutable.'; END IF;
  IF current_user IS DISTINCT FROM trusted THEN RAISE EXCEPTION 'Link participation through its atomic logging or correction action.'; END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='owner_program_events' THEN
  IF TG_OP<>'INSERT' AND OLD.kind IN ('time_entry','time_corrected','time_entry_reviewed') THEN
   RAISE EXCEPTION 'Participation history is immutable.';
  END IF;
  IF TG_OP<>'DELETE' AND NEW.kind IN ('time_entry','time_corrected','time_entry_reviewed') THEN
   IF TG_OP<>'INSERT' OR current_user IS DISTINCT FROM trusted THEN
    RAISE EXCEPTION 'Participation history must be recorded by its atomic action.';
   END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Unsupported participation write guard.';
END $$;
REVOKE ALL ON FUNCTION public.guard_owner_time_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER owner_time_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.owner_time_entries FOR EACH ROW EXECUTE FUNCTION public.guard_owner_time_write();
CREATE TRIGGER owner_time_property_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.owner_time_entry_properties FOR EACH ROW EXECUTE FUNCTION public.guard_owner_time_write();
CREATE TRIGGER owner_time_event_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.owner_program_events FOR EACH ROW EXECUTE FUNCTION public.guard_owner_time_write();

DROP POLICY "Owners log their own time" ON public.owner_time_entries;
DROP POLICY "Owners link their own entries" ON public.owner_time_entry_properties;
DROP POLICY "Supervisors review owner time entries" ON public.owner_time_entries;
