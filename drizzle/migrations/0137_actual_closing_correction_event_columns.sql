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
  INSERT INTO owner_program_events(program_id,property_id,kind,summary,detail,previous_value,new_value,reason,actor_id)
   VALUES(enr.program_id,_property_id,'closing_corrected','Actual closing corrected',
     'Actual closing for '||prop.name||' corrected by staff. Logged activities were kept; counting follows the new date.',
     coalesce(enr.closing_date::text,'blank'),_new_date::text,_reason,uid);
 END LOOP;
 PERFORM set_config('app.closing_correction','off',true);
 INSERT INTO audit_log(actor_id,action,entity_type,entity_id,entity_label,reason,before_value,after_value)
  VALUES(uid,'actual_closing_corrected','property',_property_id,prop.name,_reason,
   jsonb_build_object('actual_closing_on',prev),jsonb_build_object('actual_closing_on',_new_date,'enrollments_updated',n));
 RETURN jsonb_build_object('previous',prev,'new',_new_date,'enrollments',n);
END $$;