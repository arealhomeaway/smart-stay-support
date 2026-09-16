-- Serialize enrollment eligibility with activation, including writes that used
-- to acquire the program lock only through an AFTER report-version trigger.
CREATE FUNCTION public.guard_owner_enrollment_activation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[]; locked_id uuid; program public.owner_programs; home public.properties; joining boolean;
BEGIN
 IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.program_id];
 ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.program_id];
 ELSE ids:=ARRAY[OLD.program_id,NEW.program_id]; END IF;
 FOR locked_id IN SELECT DISTINCT id FROM unnest(ids) id WHERE id IS NOT NULL ORDER BY id LOOP
  PERFORM 1 FROM public.owner_programs WHERE id=locked_id FOR UPDATE NOWAIT;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.inclusion_status IS DISTINCT FROM 'included' OR NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=NEW.program_id;
 IF NOT FOUND OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed','complete') THEN
  RAISE EXCEPTION 'This program is no longer open for enrollment changes.';
 END IF;
 SELECT * INTO home FROM public.properties WHERE id=NEW.property_id FOR SHARE NOWAIT;
 IF NOT FOUND OR home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM program.owner_record_id
  OR program.owner_record_id IS NULL OR home.is_demo IS DISTINCT FROM program.is_demo OR NEW.is_demo IS DISTINCT FROM program.is_demo THEN
  RAISE EXCEPTION 'Enrollment requires a current Property with the same canonical Owner and demo mode as its program.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment requires an active canonical Owner.'; END IF;
 joining:=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN
  joining:=OLD.program_id IS DISTINCT FROM NEW.program_id OR OLD.property_id IS DISTINCT FROM NEW.property_id
   OR OLD.inclusion_status IS DISTINCT FROM 'included' OR OLD.archived_at IS NOT NULL;
 END IF;
 IF joining AND program.started_on IS NOT NULL THEN
  IF auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
   RAISE EXCEPTION 'Adding a property to a program already underway needs administrator approval.';
  END IF;
  IF NOT coalesce(NEW.closing_confirmed,false) OR NEW.closing_date IS NULL OR NEW.closing_date>current_date THEN
   RAISE EXCEPTION 'Confirm the property''s closing date before adding it to an active program.';
  END IF;
 END IF;
 RETURN NEW;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This program or Property is being updated. Refresh and try the enrollment change again.';
END $$;
REVOKE ALL ON FUNCTION public.guard_owner_enrollment_activation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enrollment_activation_guard
 BEFORE INSERT OR DELETE OR UPDATE OF program_id,property_id,inclusion_status,closing_date,closing_confirmed,is_demo,archived_at
 ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION public.guard_owner_enrollment_activation();

-- Explicitly invoked once: no closing date or enrollment write starts the clock.
CREATE FUNCTION public.activate_owner_program(_program_id uuid,_expected_version uuid,_started_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs; enrollment public.owner_program_properties; home public.properties;
 property_count integer:=0; closing_snapshot jsonb:='[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'manager'),false)) THEN
  RAISE EXCEPTION 'Only a supervisor can activate owner participation programs.';
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
 UPDATE public.owner_programs SET started_on=_started_on,ends_on=_started_on+89,status='active',
  activated_at=now(),activated_by=auth.uid() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,previous_value,new_value,detail)
 VALUES(program.id,'program_activated','90-day participation program activated.',auth.uid(),program.status,_started_on::text,
  jsonb_build_object('ownerId',program.owner_record_id,'closings',closing_snapshot,'dfyConfirmed',program.dfy_confirmed,
   'dfyConfirmedAt',program.dfy_confirmed_at,'startedOn',_started_on,'endsOn',_started_on+89,'reviewedVersion',_expected_version));
 RETURN program.id;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This program or Property is being updated. Refresh and try activation again.';
END $$;
REVOKE ALL ON FUNCTION public.activate_owner_program(uuid,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activate_owner_program(uuid,uuid,date) TO authenticated,service_role;

-- Ordinary table writes cannot bypass activation or replace an existing clock.
-- Legacy clocks are left untouched; privileged seed functions keep their own
-- explicit authorization, while every interactive activation uses the RPC.
CREATE FUNCTION public.preserve_owner_program_clock() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE clock_changed boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  clock_changed:=NEW.started_on IS NOT NULL OR NEW.ends_on IS NOT NULL OR NEW.activated_at IS NOT NULL OR NEW.activated_by IS NOT NULL;
 ELSE
  clock_changed:=NEW.started_on IS DISTINCT FROM OLD.started_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on
   OR NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by IS DISTINCT FROM OLD.activated_by;
  IF OLD.started_on IS NOT NULL AND clock_changed THEN
   RAISE EXCEPTION 'The activated program clock and its activation record cannot be reset.';
  END IF;
 END IF;
 IF clock_changed AND current_user IS DISTINCT FROM (
  SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.activate_owner_program(uuid,uuid,date)'::regprocedure
 ) THEN RAISE EXCEPTION 'Start the program through the atomic activation action.'; END IF;
 IF NEW.status IN ('active','target_reached') AND NEW.started_on IS NULL THEN
  RAISE EXCEPTION 'Start the program through the atomic activation action.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preserve_owner_program_clock() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_owner_program_clock BEFORE INSERT OR UPDATE OF started_on,ends_on,activated_at,activated_by,status
 ON public.owner_programs FOR EACH ROW EXECUTE FUNCTION public.preserve_owner_program_clock();
