CREATE OR REPLACE FUNCTION private.can_correct_actual_closing(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND (public.has_role(_uid,'manager')
    OR public.seat_holder_at('director_ops')=_uid
    OR public.seat_holder_at('director_onboarding')=_uid)
$$;

CREATE OR REPLACE FUNCTION public.can_correct_actual_closing()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.can_correct_actual_closing(auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.can_correct_actual_closing() TO authenticated;

CREATE OR REPLACE FUNCTION public.preserve_owner_program_clock()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE clock_changed boolean; trusted boolean; correcting boolean;
BEGIN
 trusted:=current_user=(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.activate_owner_program(uuid,uuid,date)'::regprocedure);
 correcting:=trusted AND coalesce(current_setting('app.closing_correction',true),'')='on';
 IF TG_OP='INSERT' THEN
  clock_changed:=NEW.started_on IS NOT NULL OR NEW.ends_on IS NOT NULL OR NEW.activated_at IS NOT NULL OR NEW.activated_by IS NOT NULL;
 ELSE
  clock_changed:=NEW.started_on IS DISTINCT FROM OLD.started_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on
   OR NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by IS DISTINCT FROM OLD.activated_by;
  IF OLD.started_on IS NOT NULL AND clock_changed AND NOT correcting THEN
   IF NOT trusted OR NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by IS DISTINCT FROM OLD.activated_by
    OR NEW.started_on IS NULL OR NEW.started_on>OLD.started_on
    OR (OLD.ends_on IS NOT NULL AND (NEW.ends_on IS NULL OR NEW.ends_on<OLD.ends_on)) THEN
    RAISE EXCEPTION 'The activated program clock and its activation record cannot be reset.';
   END IF;
  END IF;
  IF correcting AND (NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by IS DISTINCT FROM OLD.activated_by OR (OLD.started_on IS NOT NULL AND NEW.started_on IS NULL)) THEN
   RAISE EXCEPTION 'A closing correction cannot change the activation record.';
  END IF;
 END IF;
 IF clock_changed AND NOT trusted THEN RAISE EXCEPTION 'Start the program through the atomic activation action.'; END IF;
 IF NEW.status IN ('active','target_reached') AND NEW.started_on IS NULL THEN
  RAISE EXCEPTION 'Start the program through the atomic activation action.';
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.correct_actual_closing(_property_id uuid, _new_date date, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid:=auth.uid(); prev date; prop record; enr record; first_close date; last_close date; n int:=0;
BEGIN
 IF NOT private.can_correct_actual_closing(uid) THEN
  RAISE EXCEPTION 'Only a Director or Manager can correct an actual closing date.';
 END IF;
 IF _new_date IS NULL THEN RAISE EXCEPTION 'Enter the corrected actual closing date.'; END IF;
 IF coalesce(trim(_reason),'')='' THEN RAISE EXCEPTION 'Give a reason for the correction.'; END IF;
 SELECT id,name,actual_closing_on INTO prop FROM properties WHERE id=_property_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Property not found.'; END IF;
 prev:=prop.actual_closing_on;
 UPDATE properties SET actual_closing_on=_new_date WHERE id=_property_id;
 PERFORM set_config('app.closing_correction','on',true);
 FOR enr IN SELECT id,program_id,closing_date FROM owner_program_properties
   WHERE property_id=_property_id AND archived_at IS NULL AND inclusion_status='included' FOR UPDATE LOOP
  UPDATE owner_program_properties SET closing_date=_new_date, closing_confirmed=true WHERE id=enr.id;
  n:=n+1;
  SELECT min(closing_date),max(closing_date) INTO first_close,last_close FROM owner_program_properties
   WHERE program_id=enr.program_id AND inclusion_status='included' AND archived_at IS NULL AND closing_confirmed AND closing_date IS NOT NULL;
  UPDATE owner_programs SET started_on=first_close, ends_on=make_date(extract(year from last_close)::int,12,31)
   WHERE id=enr.program_id AND started_on IS NOT NULL AND completed_at IS NULL;
  INSERT INTO owner_program_events(program_id,event_type,actor_id,notes,metadata)
   VALUES(enr.program_id,'closing_corrected',uid,'Actual closing corrected for '||prop.name||': '||coalesce(enr.closing_date::text,'blank')||' → '||_new_date,
     jsonb_build_object('property_id',_property_id,'previous',enr.closing_date,'new',_new_date,'reason',_reason));
 END LOOP;
 PERFORM set_config('app.closing_correction','off',true);
 INSERT INTO audit_log(actor_id,action,entity_type,entity_id,entity_label,reason,before_value,after_value)
  VALUES(uid,'actual_closing_corrected','property',_property_id,prop.name,_reason,
   jsonb_build_object('actual_closing_on',prev),jsonb_build_object('actual_closing_on',_new_date,'enrollments_updated',n));
 RETURN jsonb_build_object('previous',prev,'new',_new_date,'enrollments',n);
END $$;
REVOKE ALL ON FUNCTION public.correct_actual_closing(uuid,date,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.correct_actual_closing(uuid,date,text) TO authenticated;
ALTER FUNCTION public.correct_actual_closing(uuid,date,text) OWNER TO postgres;