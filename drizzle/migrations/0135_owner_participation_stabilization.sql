-- Stabilization (Emily, Oct 6): no DFY gate, no staff-entered Day One, per-property
-- closing-through-Dec-31 windows, staff-led account linking without invite codes.

-- 1. Clock may only WIDEN (earlier start / later end) through trusted actions; never narrow.
CREATE OR REPLACE FUNCTION public.preserve_owner_program_clock()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE clock_changed boolean; trusted boolean;
BEGIN
 trusted:=current_user=(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.activate_owner_program(uuid,uuid,date)'::regprocedure);
 IF TG_OP='INSERT' THEN
  clock_changed:=NEW.started_on IS NOT NULL OR NEW.ends_on IS NOT NULL OR NEW.activated_at IS NOT NULL OR NEW.activated_by IS NOT NULL;
 ELSE
  clock_changed:=NEW.started_on IS DISTINCT FROM OLD.started_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on
   OR NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by IS DISTINCT FROM OLD.activated_by;
  IF OLD.started_on IS NOT NULL AND clock_changed THEN
   IF NOT trusted OR NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by IS DISTINCT FROM OLD.activated_by
    OR NEW.started_on IS NULL OR NEW.started_on>OLD.started_on
    OR (OLD.ends_on IS NOT NULL AND (NEW.ends_on IS NULL OR NEW.ends_on<OLD.ends_on)) THEN
    RAISE EXCEPTION 'The activated program clock and its activation record cannot be reset.';
   END IF;
  END IF;
 END IF;
 IF clock_changed AND NOT trusted THEN RAISE EXCEPTION 'Start the program through the atomic activation action.'; END IF;
 IF NEW.status IN ('active','target_reached') AND NEW.started_on IS NULL THEN
  RAISE EXCEPTION 'Start the program through the atomic activation action.';
 END IF;
 RETURN NEW;
END $function$;

-- 2. Enable participation: no DFY gate, no separate start date. The window spans the
--    earliest confirmed closing through Dec 31 of the latest confirmed closing year.
--    Homes without a confirmed closing do not block homes that have one.
--    _started_on is accepted for compatibility with the current live screen and ignored.
CREATE OR REPLACE FUNCTION public.activate_owner_program(_program_id uuid, _expected_version uuid, _started_on date)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE program public.owner_programs; enrollment public.owner_program_properties; home public.properties;
 confirmed_count integer:=0; first_close date; last_close date; closing_snapshot jsonb:='[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'manager'),false) OR coalesce(public.is_onboarding_director(auth.uid()),false)) THEN
  RAISE EXCEPTION 'Only a supervisor or the Onboarding Director can enable owner participation.';
 END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_version IS NULL OR program.report_version IS DISTINCT FROM _expected_version THEN
  RAISE EXCEPTION 'The program or its properties changed. Review current details first.';
 END IF;
 IF program.is_demo AND NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.is_onboarding_director(auth.uid()),false)) THEN
  RAISE EXCEPTION 'Only an administrator or the Onboarding Director can enable a demo owner program.';
 END IF;
 IF program.archived_at IS NOT NULL OR program.status NOT IN ('draft','pending','waiting_for_closing','ready_for_onboarding')
  OR program.started_on IS NOT NULL OR program.ends_on IS NOT NULL OR program.activated_at IS NOT NULL OR program.activated_by IS NOT NULL OR program.completed_at IS NOT NULL THEN
  RAISE EXCEPTION 'Participation is already enabled for this program.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participation requires an active canonical Owner.'; END IF;
 FOR enrollment IN SELECT * FROM public.owner_program_properties WHERE program_id=program.id AND inclusion_status='included' AND archived_at IS NULL
  ORDER BY property_id FOR SHARE NOWAIT LOOP
  IF enrollment.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Every included Property must match the program demo mode.';
  END IF;
  SELECT * INTO home FROM public.properties WHERE id=enrollment.property_id FOR SHARE NOWAIT;
  IF NOT FOUND OR home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Every included Property must reference this active canonical Owner and match the program demo mode.';
  END IF;
  IF coalesce(enrollment.closing_confirmed,false) AND enrollment.closing_date IS NOT NULL AND isfinite(enrollment.closing_date) THEN
   confirmed_count:=confirmed_count+1;
   first_close:=least(coalesce(first_close,enrollment.closing_date),enrollment.closing_date);
   last_close:=greatest(coalesce(last_close,enrollment.closing_date),enrollment.closing_date);
   closing_snapshot:=closing_snapshot||jsonb_build_array(jsonb_build_object('propertyId',home.id,'closingDate',enrollment.closing_date));
  END IF;
 END LOOP;
 IF confirmed_count=0 THEN RAISE EXCEPTION 'Confirm the actual closing date of at least one included home first.'; END IF;
 UPDATE public.owner_programs SET started_on=first_close,ends_on=make_date(extract(year from last_close)::int,12,31),status='active',
  activated_at=now(),activated_by=auth.uid() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,previous_value,new_value,detail)
 VALUES(program.id,'program_activated','Participation enabled. Each home counts from its confirmed closing through December 31.',auth.uid(),program.status,first_close::text,
  jsonb_build_object('ownerId',program.owner_record_id,'closings',closing_snapshot,'startedOn',first_close,
   'endsOn',make_date(extract(year from last_close)::int,12,31),'reviewedVersion',_expected_version,'rule','per_property_closing_to_dec31'));
 RETURN program.id;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This program or Property is being updated. Refresh and try again.';
END $function$;

-- 3. Widen an enabled program's span when another home's closing is confirmed later.
CREATE OR REPLACE FUNCTION private.widen_owner_program_window(_program_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE program public.owner_programs; first_close date; last_close date;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id;
 IF NOT FOUND OR program.started_on IS NULL OR program.completed_at IS NOT NULL THEN RETURN; END IF;
 SELECT min(closing_date),max(closing_date) INTO first_close,last_close FROM public.owner_program_properties
  WHERE program_id=_program_id AND inclusion_status='included' AND archived_at IS NULL AND closing_confirmed AND closing_date IS NOT NULL;
 IF first_close IS NULL THEN RETURN; END IF;
 IF first_close<program.started_on OR make_date(extract(year from last_close)::int,12,31)>coalesce(program.ends_on,'-infinity'::date) THEN
  UPDATE public.owner_programs SET started_on=least(program.started_on,first_close),
   ends_on=greatest(coalesce(program.ends_on,make_date(extract(year from last_close)::int,12,31)),make_date(extract(year from last_close)::int,12,31))
  WHERE id=_program_id;
 END IF;
END $function$;
ALTER FUNCTION private.widen_owner_program_window(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION private.widen_owner_program_window_trigger()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN PERFORM private.widen_owner_program_window(NEW.program_id); RETURN NULL; END $function$;
DROP TRIGGER IF EXISTS enrollment_widen_program_window ON public.owner_program_properties;
CREATE TRIGGER enrollment_widen_program_window AFTER INSERT OR UPDATE OF closing_date, closing_confirmed, inclusion_status
 ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION private.widen_owner_program_window_trigger();

-- 4. Logging: date must fall in at least one included home's closing→Dec 31 window.
--    Property tags describe where work happened; a tag never requires that home to be closed.
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
 IF entry_day IS NULL OR NOT isfinite(entry_day) OR entry_day>current_date THEN
  RAISE EXCEPTION 'Choose a date no later than today.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_program_properties e JOIN public.properties h ON h.id=e.property_id
  WHERE e.program_id=program.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=program.is_demo
   AND e.closing_confirmed AND e.closing_date IS NOT NULL AND e.closing_date<=entry_day
   AND entry_day<=make_date(extract(year from e.closing_date)::int,12,31)
   AND h.owner_record_id=program.owner_record_id AND h.archived_at IS NULL AND h.is_demo=program.is_demo) THEN
  RAISE EXCEPTION 'That date is outside every home''s participation window (confirmed closing through December 31).';
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

-- 5. Staff-led account link: no invite code. Actor recorded as the staff member.
CREATE OR REPLACE FUNCTION public.staff_link_owner_account(_program_id uuid, _user_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE account auth.users; program public.owner_programs; included uuid[];
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'manager'),false) OR coalesce(public.is_onboarding_director(auth.uid()),false)) THEN
  RAISE EXCEPTION 'Only a supervisor or the Onboarding Director can link a homeowner account.';
 END IF;
 SELECT * INTO account FROM auth.users WHERE id=_user_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR account.deleted_at IS NOT NULL OR (account.banned_until IS NOT NULL AND account.banned_until>now()) THEN
  RAISE EXCEPTION 'Choose an enabled homeowner account.';
 END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR program.archived_at IS NOT NULL OR program.completed_at IS NOT NULL THEN
  RAISE EXCEPTION 'This program is not available for account linking.';
 END IF;
 IF program.is_demo THEN RAISE EXCEPTION 'Link demo programs through the demo owner action.'; END IF;
 IF program.owner_user_id IS NOT NULL THEN
  IF program.owner_user_id=_user_id THEN RETURN program.id; END IF;
  RAISE EXCEPTION 'This program is already linked to another owner account.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Confirm the active canonical Owner first.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_programs WHERE owner_user_id=_user_id AND id<>program.id AND archived_at IS NULL) THEN
  RAISE EXCEPTION 'This account is already linked to another program. Add the home to that program instead.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text<>'owner') THEN
  RAISE EXCEPTION 'This account has staff access. Homeowner accounts must be separate.';
 END IF;
 SELECT coalesce(array_agg(property_id ORDER BY property_id),'{}') INTO included FROM public.owner_program_properties
  WHERE program_id=program.id AND inclusion_status='included' AND archived_at IS NULL;
 UPDATE public.owner_programs SET owner_user_id=_user_id WHERE id=program.id;
 INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,'owner') ON CONFLICT(user_id,role) DO NOTHING;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,detail)
 VALUES(program.id,'owner_linked','Staff linked the homeowner''s account to this program.',auth.uid(),
  jsonb_build_object('source','staff_link','linkedUserId',_user_id,'ownerId',program.owner_record_id,'propertyIds',to_jsonb(included)));
 RETURN program.id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'This account or program is being updated. Refresh and try again.';
END $function$;
REVOKE ALL ON FUNCTION public.staff_link_owner_account(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_link_owner_account(uuid,uuid) TO authenticated;

-- Allow the staff link through the existing account-link guard (same function owner).
CREATE OR REPLACE FUNCTION public.guard_owner_account_link()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
 IF TG_OP='INSERT' AND NEW.owner_user_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN RETURN NEW; END IF;
 IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.redeem_owner_invite(uuid,text)'::regprocedure) THEN
  RAISE EXCEPTION 'Link the owner account through the checked staff or invitation action.';
 END IF;
 RETURN NEW;
END $function$;

-- 6. One authoritative actual closing: a confirmed enrollment closing fills a blank
--    properties.actual_closing_on; it never overwrites a different stored actual date.
CREATE OR REPLACE FUNCTION private.sync_actual_closing_trigger()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
 IF NEW.closing_confirmed AND NEW.closing_date IS NOT NULL AND NEW.inclusion_status='included' THEN
  UPDATE public.properties SET actual_closing_on=NEW.closing_date WHERE id=NEW.property_id AND actual_closing_on IS NULL;
 END IF;
 RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS enrollment_sync_actual_closing ON public.owner_program_properties;
CREATE TRIGGER enrollment_sync_actual_closing AFTER INSERT OR UPDATE OF closing_date, closing_confirmed
 ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION private.sync_actual_closing_trigger();

-- Backfill: blank actual closings that already have a confirmed enrollment (Foxtail; demo Willow Creek).
UPDATE public.properties h SET actual_closing_on=e.closing_date
FROM public.owner_program_properties e
WHERE e.property_id=h.id AND e.closing_confirmed AND e.closing_date IS NOT NULL AND e.inclusion_status='included'
 AND e.archived_at IS NULL AND h.actual_closing_on IS NULL;