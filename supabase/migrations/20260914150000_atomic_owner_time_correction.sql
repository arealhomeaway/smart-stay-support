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
