-- Business date for owner hour eligibility: America/Chicago calendar day (coverage_config convention).
CREATE OR REPLACE FUNCTION private.business_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Chicago')::date $$;

-- Hour entry opens when any included home has a confirmed actual closing on or before the business date.
CREATE OR REPLACE FUNCTION public.owner_hours_eligibility(_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.owner_programs; first_open date; next_closing date;
BEGIN
 SELECT * INTO p FROM public.owner_programs WHERE id=_program_id;
 IF NOT FOUND OR NOT (p.owner_user_id=auth.uid() OR coalesce(public.is_internal_staff(auth.uid()),false)) THEN
  RETURN jsonb_build_object('eligible',false,'reason','unavailable');
 END IF;
 IF p.archived_at IS NOT NULL OR p.completed_at IS NOT NULL OR p.status IN ('completed','paused') THEN
  RETURN jsonb_build_object('eligible',false,'reason',CASE WHEN p.status='paused' THEN 'paused' ELSE 'closed' END);
 END IF;
 SELECT min(e.closing_date) FILTER (WHERE e.closing_date<=private.business_today()),
        min(e.closing_date) FILTER (WHERE e.closing_date>private.business_today())
   INTO first_open, next_closing
   FROM public.owner_program_properties e
  WHERE e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo
    AND e.closing_confirmed AND e.closing_date IS NOT NULL;
 IF first_open IS NOT NULL THEN RETURN jsonb_build_object('eligible',true,'openedOn',first_open); END IF;
 IF next_closing IS NOT NULL THEN RETURN jsonb_build_object('eligible',false,'reason','closing_future','closingOn',next_closing); END IF;
 RETURN jsonb_build_object('eligible',false,'reason','no_confirmed_closing');
END $$;
REVOKE ALL ON FUNCTION public.owner_hours_eligibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_hours_eligibility(uuid) TO authenticated;

-- New owner activity: draft or active programs open automatically once a confirmed closing has arrived.
CREATE OR REPLACE FUNCTION private.lock_owner_time_program(_program_id uuid, _actor_id uuid, _staff boolean, _new_activity boolean)
 RETURNS owner_programs LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE program public.owner_programs; arrived boolean;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _actor_id IS NULL OR program.archived_at IS NOT NULL OR program.completed_at IS NOT NULL THEN
  RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.inclusion_status='included'
   AND e.archived_at IS NULL AND e.is_demo=program.is_demo AND e.closing_confirmed AND e.closing_date IS NOT NULL
   AND e.closing_date<=private.business_today()) INTO arrived;
 IF _new_activity AND NOT _staff THEN
  IF coalesce(program.status,'') NOT IN ('draft','active','target_reached') THEN
   RAISE EXCEPTION 'This program is not open for this participation change.';
  END IF;
  IF NOT arrived THEN
   RAISE EXCEPTION 'Hour entry opens once your property''s actual closing date is confirmed and that date has arrived.';
  END IF;
 ELSIF (program.started_on IS NULL OR NOT isfinite(program.started_on)) AND NOT (program.status='draft' AND arrived)
  OR (_new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','draft'))
  OR (NOT _new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','paused','draft')) THEN
  RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=_actor_id AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled account is required for participation changes.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=_actor_id FOR SHARE NOWAIT;
 IF _staff THEN
  IF NOT (coalesce(public.has_role(_actor_id,'admin'),false) OR coalesce(public.has_role(_actor_id,'manager'),false))
   OR (program.is_demo AND NOT coalesce(public.has_role(_actor_id,'admin'),false)) THEN
   RAISE EXCEPTION 'Only an authorized supervisor can review or correct participation.';
  END IF;
 ELSE
  IF program.owner_user_id IS DISTINCT FROM _actor_id
   OR (program.is_demo AND NOT (_actor_id=auth.uid() AND private.is_synthetic_account()
        AND coalesce(private.demo_owner_link_ok(_actor_id, program.id),false)))
   OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text='owner')
   OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text<>'owner') THEN
   RAISE EXCEPTION 'That participation program is not available to you.';
  END IF;
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participation requires an active canonical Owner.'; END IF;
 RETURN program;
END $function$;

-- enroll_active_owner no longer activates: hour entry follows the closing rule above.
CREATE OR REPLACE FUNCTION public.enroll_active_owner(_property_id uuid, _owner_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; pid uuid; program public.owner_programs; account_email text; activated boolean := false;
  welcome_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'manager'),false) OR coalesce(public.is_onboarding_director(auth.uid()),false)) THEN
    RAISE EXCEPTION 'Only a supervisor or the Onboarding Director can set up an Active Owner.';
  END IF;
  SELECT email INTO account_email FROM auth.users WHERE id=_owner_user_id AND deleted_at IS NULL;
  IF account_email IS NULL THEN RAISE EXCEPTION 'Choose an enabled homeowner account.'; END IF;
  r := public.create_owner_program(_property_id);
  pid := (r->>'programId')::uuid;
  SELECT * INTO program FROM public.owner_programs WHERE id=pid;
  IF program.owner_user_id IS DISTINCT FROM _owner_user_id THEN
    IF program.is_demo THEN
      PERFORM public.link_demo_owner_account(pid, _owner_user_id, 'Active Owner setup');
    ELSE
      PERFORM public.staff_link_owner_account(pid, _owner_user_id);
    END IF;
    SELECT * INTO program FROM public.owner_programs WHERE id=pid;
  END IF;
  INSERT INTO public.owner_welcome_messages(program_id, owner_user_id, property_id, recipient, status, queued_by, is_demo)
  VALUES (pid, _owner_user_id, _property_id, account_email, CASE WHEN program.is_demo THEN 'held_demo' ELSE 'queued' END, auth.uid(), program.is_demo)
  ON CONFLICT (program_id, owner_user_id) DO NOTHING RETURNING id INTO welcome_id;
  IF welcome_id IS NOT NULL THEN
    INSERT INTO public.owner_program_events(program_id, property_id, kind, summary, actor_id, detail)
    VALUES (pid, _property_id, 'welcome_queued', 'Welcome email queued after Active Owner setup.', auth.uid(),
      jsonb_build_object('welcomeId', welcome_id, 'demo', program.is_demo));
  END IF;
  RETURN jsonb_build_object('programId', pid, 'alreadyEnrolled', coalesce((r->>'alreadyExists')::boolean,false),
    'participationOpen', coalesce((public.owner_hours_eligibility(pid)->>'eligible')::boolean,false), 'activatedNow', activated, 'welcomeQueued', welcome_id IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.log_owner_time_entry(_entry jsonb, _property_ids uuid[])
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE program public.owner_programs; opportunity public.owner_reviews; enrollment public.owner_program_properties;
 home public.properties; link record; chosen uuid[]; context_ids uuid[]; chosen_property uuid;
 entry_day date; reported_minutes integer; new_id uuid; ticket public.tickets; manual boolean;
 paths jsonb; path_item text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record participation.'; END IF;
 IF _entry IS NULL OR jsonb_typeof(_entry) IS DISTINCT FROM 'object' OR (_entry->'confirmed') IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'Confirm that this entry records the time you personally spent.';
 END IF;
 program:=private.lock_owner_time_program((_entry->>'programId')::uuid,auth.uid(),false,true);
 entry_day:=(_entry->>'entryDate')::date; reported_minutes:=(_entry->>'minutes')::integer;
 manual:=nullif(_entry->>'reviewId','') IS NULL;
 IF entry_day IS NULL OR NOT isfinite(entry_day) OR entry_day>private.business_today() THEN
  RAISE EXCEPTION 'Choose a date no later than today.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_program_properties e JOIN public.properties h ON h.id=e.property_id
  WHERE e.program_id=program.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=program.is_demo
   AND e.closing_confirmed AND e.closing_date IS NOT NULL AND e.closing_date<=private.business_today()
   AND extract(year from e.closing_date)=extract(year from entry_day)
   AND h.owner_record_id=program.owner_record_id AND h.archived_at IS NULL AND h.is_demo=program.is_demo) THEN
  RAISE EXCEPTION 'That date is outside the participation year of every home whose confirmed closing has arrived.';
 END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440
  OR length(trim(coalesce(_entry->>'activity',''))) NOT BETWEEN 3 AND 500
  OR coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing')
  OR length(coalesce(_entry->>'activityCategory',''))>80 OR length(coalesce(_entry->>'output',''))>1000
  OR length(coalesce(_entry->>'comments',''))>1000 OR length(coalesce(_entry->>'attachmentPath',''))>400 THEN
  RAISE EXCEPTION 'Enter the actual activity, phase and minutes within the allowed limits.';
 END IF;
 paths:=coalesce(_entry->'attachmentPaths','[]'::jsonb);
 IF jsonb_typeof(paths) IS DISTINCT FROM 'array' OR jsonb_array_length(paths)>10 THEN
  RAISE EXCEPTION 'Attach at most ten files to one entry.';
 END IF;
 FOR path_item IN SELECT jsonb_array_elements_text(paths) LOOP
  IF path_item IS NULL OR length(trim(path_item)) NOT BETWEEN 1 AND 400 THEN
   RAISE EXCEPTION 'One of the attached files could not be recorded. Try again.';
  END IF;
 END LOOP;
 IF jsonb_array_length(paths)>0 AND nullif(_entry->>'attachmentPath','') IS DISTINCT FROM (paths->>0) THEN
  RAISE EXCEPTION 'The attached files could not be recorded. Try again.';
 END IF;
 IF cardinality(coalesce(_property_ids,'{}'::uuid[]))>25 OR array_position(_property_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Choose at most 25 valid properties.';
 END IF;
 SELECT coalesce(array_agg(DISTINCT p ORDER BY p),'{}'::uuid[]) INTO chosen FROM unnest(coalesce(_property_ids,'{}'::uuid[])) p;
 IF manual THEN
  IF nullif(_entry->>'ticketId','') IS NOT NULL THEN
   RAISE EXCEPTION 'A self-recorded activity cannot carry a Ticket link.';
  END IF;
  context_ids:=chosen;
 ELSE
  SELECT * INTO opportunity FROM public.owner_reviews WHERE id=(_entry->>'reviewId')::uuid AND program_id=program.id FOR SHARE NOWAIT;
  IF NOT FOUND OR opportunity.archived_at IS NOT NULL OR opportunity.is_demo IS DISTINCT FROM program.is_demo
   OR coalesce(opportunity.status,'') NOT IN ('awaiting_owner','answered','returned') OR opportunity.available_from>now() OR opportunity.available_from::date>entry_day
   OR opportunity.phase IS DISTINCT FROM (_entry->>'phase') THEN
   RAISE EXCEPTION 'Choose an available participation opportunity from this program.';
  END IF;
  IF opportunity.task_type NOT IN ('property_specific','multi_property','program_wide') OR opportunity.task_type IS NULL THEN
   RAISE EXCEPTION 'This opportunity needs a valid participation scope.';
  END IF;
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
 END IF;
 FOR chosen_property IN SELECT DISTINCT p FROM unnest(context_ids) p ORDER BY p LOOP
  SELECT * INTO enrollment FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.property_id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR enrollment.inclusion_status IS DISTINCT FROM 'included' OR enrollment.archived_at IS NOT NULL
   OR enrollment.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Tag only homes included in this program.';
  END IF;
  SELECT * INTO home FROM public.properties h WHERE h.id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.archived_at IS NOT NULL
   OR home.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'That Property is no longer available to this Owner.'; END IF;
 END LOOP;
 IF NOT manual THEN
  IF nullif(_entry->>'ticketId','')::uuid IS DISTINCT FROM opportunity.ticket_id THEN
   RAISE EXCEPTION 'Time must retain its participation opportunity Ticket link.';
  END IF;
  IF opportunity.ticket_id IS NOT NULL THEN
   SELECT * INTO ticket FROM public.tickets WHERE id=opportunity.ticket_id FOR SHARE NOWAIT;
   IF NOT FOUND OR ticket.property_id IS DISTINCT FROM opportunity.property_id OR NOT ticket.property_id=ANY(chosen)
    OR ticket.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The opportunity Ticket context changed.'; END IF;
  END IF;
 END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,attachment_paths,review_id,ticket_id,attested,is_demo,owner_update_revision,review_status)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),paths,opportunity.id,opportunity.ticket_id,true,program.is_demo,
  CASE WHEN manual THEN NULL ELSE nullif(_entry->>'ownerUpdateRevision','')::integer END,'submitted')
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
 UPDATE public.owner_program_properties e SET last_owner_activity_at=now() WHERE e.program_id=program.id AND e.property_id=ANY(chosen);
 UPDATE public.owner_programs SET last_owner_activity_at=now() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text||' minutes reported: '||trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
  jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory','selfRecorded',manual,'attachmentCount',jsonb_array_length(paths)));
 RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or opportunity is being updated. Refresh and try again.';
END $function$;