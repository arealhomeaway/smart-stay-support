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
