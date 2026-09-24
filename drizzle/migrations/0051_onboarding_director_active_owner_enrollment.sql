CREATE POLICY "Onboarding Director manages owner programs" ON public.owner_programs FOR ALL TO authenticated
  USING (public.is_onboarding_director(auth.uid())) WITH CHECK (public.is_onboarding_director(auth.uid()));
CREATE POLICY "Onboarding Director manages owner invites" ON public.owner_invites FOR ALL TO authenticated
  USING (public.is_onboarding_director(auth.uid())) WITH CHECK (public.is_onboarding_director(auth.uid()));
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
 IF program.is_demo AND NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
  RAISE EXCEPTION 'Only an administrator can activate a demo owner program.';
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