CREATE OR REPLACE FUNCTION private.owner_lifecycle_program(_program_id uuid, _expected_version uuid, _supervisor boolean DEFAULT true)
 RETURNS owner_programs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; actor uuid:=private.owner_lifecycle_staff(_supervisor); BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_version IS NULL OR program.report_version IS DISTINCT FROM _expected_version THEN
  RAISE EXCEPTION 'The program changed. Review the current details before saving; your draft can be kept.';
 END IF;
 IF program.archived_at IS NOT NULL OR program.status IN('closed','completed','complete') THEN RAISE EXCEPTION 'This program is no longer open for changes.'; END IF;
 IF program.is_demo AND NOT (coalesce(public.has_role(actor,'admin'),false) OR coalesce(public.is_onboarding_director(actor),false)) THEN RAISE EXCEPTION 'Only an administrator or the Onboarding Director can change a demo owner program.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'This program requires an active canonical Owner.'; END IF;
 RETURN program;
END $function$;

CREATE OR REPLACE FUNCTION private.owner_lifecycle_staff(_supervisor boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE actor uuid:=auth.uid(); BEGIN
 PERFORM 1 FROM auth.users WHERE id=actor AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled staff account is required.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=actor FOR SHARE NOWAIT;
 IF (_supervisor AND NOT(coalesce(public.has_role(actor,'admin'),false) OR coalesce(public.has_role(actor,'manager'),false) OR coalesce(public.is_onboarding_director(actor),false)))
  OR (NOT _supervisor AND NOT coalesce(public.is_internal_staff(actor),false)) THEN RAISE EXCEPTION 'You do not have access to manage this owner program.'; END IF;
 RETURN actor;
END $function$;

CREATE OR REPLACE FUNCTION public.create_owner_program(_property_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE actor uuid:=private.owner_lifecycle_staff(true); home public.properties; owner public.property_owners;
 program public.owner_programs; included_program uuid; result jsonb;
BEGIN
 SELECT * INTO home FROM public.properties WHERE id=_property_id;
 IF NOT FOUND OR home.owner_record_id IS NULL OR home.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Link this current Property to its canonical Owner before enrolling it.'; END IF;
 SELECT * INTO owner FROM public.property_owners WHERE id=home.owner_record_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR NOT owner.active THEN RAISE EXCEPTION 'Enrollment requires an active canonical Owner.'; END IF;
 SELECT * INTO program FROM public.owner_programs p WHERE p.owner_record_id=owner.id AND p.is_demo=home.is_demo AND p.archived_at IS NULL AND p.status NOT IN('closed','completed','complete') FOR UPDATE NOWAIT;
 SELECT h.* INTO home FROM public.properties h WHERE h.id=_property_id AND h.owner_record_id=owner.id AND h.is_demo=home.is_demo AND h.archived_at IS NULL FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Property Owner or demo mode changed. Review enrollment again.'; END IF;
 IF home.is_demo AND NOT (coalesce(public.has_role(actor,'admin'),false) OR coalesce(public.is_onboarding_director(actor),false)) THEN RAISE EXCEPTION 'Only an administrator or the Onboarding Director can create a demo owner program.'; END IF;
 SELECT e.program_id INTO included_program FROM public.owner_program_properties e WHERE e.property_id=home.id AND e.inclusion_status='included';
 IF included_program IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.owner_programs p WHERE p.id=included_program AND p.owner_record_id=owner.id AND p.is_demo=home.is_demo) THEN RAISE EXCEPTION 'This Property has conflicting enrollment. Preserve its history and reconcile the canonical Owner.'; END IF;
  RETURN jsonb_build_object('programId',included_program,'alreadyExists',true);
 END IF;
 IF program.id IS NOT NULL THEN
  result:=public.change_owner_program(program.id,program.report_version,'add_property',home.id,home.actual_closing_on);
  RETURN jsonb_build_object('programId',program.id,'alreadyExists',true);
 END IF;
 INSERT INTO public.owner_programs(property_id,owner_record_id,owner_name,owner_email,status,started_on,ends_on,target_hours,operating_target_hours,
  onboarding_target_hours,ongoing_target_hours,created_by,is_demo)
 VALUES(home.id,owner.id,owner.name,owner.email,'draft',NULL,NULL,100,105,60,40,actor,home.is_demo) RETURNING * INTO program;
 INSERT INTO public.owner_program_properties(program_id,property_id,added_by,is_demo) VALUES(program.id,home.id,actor,home.is_demo);
 INSERT INTO public.owner_program_events(program_id,property_id,kind,summary,actor_id,detail)
 VALUES(program.id,home.id,'program_created','Program created as a draft.',actor,jsonb_build_object('ownerId',owner.id));
 RETURN jsonb_build_object('programId',program.id,'alreadyExists',false);
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The canonical Owner or program is being updated. Refresh and try enrollment again.';
END $function$;

CREATE OR REPLACE FUNCTION public.activate_owner_program(_program_id uuid, _expected_version uuid, _started_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; enrollment public.owner_program_properties; home public.properties;
 property_count integer:=0; closing_snapshot jsonb:='[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'manager'),false) OR coalesce(public.is_onboarding_director(auth.uid()),false)) THEN
  RAISE EXCEPTION 'Only a supervisor or the Onboarding Director can activate owner participation programs.';
 END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_version IS NULL OR program.report_version IS DISTINCT FROM _expected_version THEN
  RAISE EXCEPTION 'The program or its properties changed. Review current details before activating.';
 END IF;
 IF program.is_demo AND NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.is_onboarding_director(auth.uid()),false)) THEN
  RAISE EXCEPTION 'Only an administrator or the Onboarding Director can activate a demo owner program.';
 END IF;
 IF program.archived_at IS NOT NULL OR program.status NOT IN ('draft','pending','waiting_for_closing','ready_for_onboarding')
  OR program.started_on IS NOT NULL OR program.ends_on IS NOT NULL OR program.activated_at IS NOT NULL OR program.activated_by IS NOT NULL OR program.completed_at IS NOT NULL THEN
  RAISE EXCEPTION 'This program cannot be activated or have its clock reset.';
 END IF;
 IF NOT coalesce(program.dfy_confirmed,false) THEN
  RAISE EXCEPTION 'Confirm with DFY that these properties run as one combined program first.';
 END IF;
 IF _started_on IS NULL OR NOT isfinite(_started_on) OR _started_on>current_date THEN
  RAISE EXCEPTION 'Choose a valid start date no later than today.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Activation requires an active canonical Owner.'; END IF;
 FOR enrollment IN SELECT * FROM public.owner_program_properties WHERE program_id=program.id AND inclusion_status='included'
  ORDER BY property_id FOR SHARE NOWAIT LOOP
  property_count:=property_count+1;
  IF enrollment.archived_at IS NOT NULL OR enrollment.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Every included Property must be current and match the program demo mode.';
  END IF;
  IF NOT coalesce(enrollment.closing_confirmed,false) OR enrollment.closing_date IS NULL OR NOT isfinite(enrollment.closing_date)
   OR enrollment.closing_date>_started_on THEN
   RAISE EXCEPTION 'The program start must be on or after every included property''s confirmed closing.';
  END IF;
  SELECT * INTO home FROM public.properties WHERE id=enrollment.property_id FOR SHARE NOWAIT;
  IF NOT FOUND OR home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM program.owner_record_id
   OR home.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Every included Property must reference this active canonical Owner and match the program demo mode.';
  END IF;
  closing_snapshot:=closing_snapshot||jsonb_build_array(jsonb_build_object('propertyId',home.id,'closingDate',enrollment.closing_date));
 END LOOP;
 IF property_count=0 THEN RAISE EXCEPTION 'Add at least one included Property before activating.'; END IF;
 UPDATE public.owner_programs SET started_on=_started_on,ends_on=make_date(extract(year from _started_on)::int,12,31),status='active',
  activated_at=now(),activated_by=auth.uid() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,previous_value,new_value,detail)
 VALUES(program.id,'program_activated','90-day participation program activated.',auth.uid(),program.status,_started_on::text,
  jsonb_build_object('ownerId',program.owner_record_id,'closings',closing_snapshot,'dfyConfirmed',program.dfy_confirmed,
   'dfyConfirmedAt',program.dfy_confirmed_at,'startedOn',_started_on,'endsOn',_started_on+89,'reviewedVersion',_expected_version));
 RETURN program.id;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This program or Property is being updated. Refresh and try activation again.';
END $function$;