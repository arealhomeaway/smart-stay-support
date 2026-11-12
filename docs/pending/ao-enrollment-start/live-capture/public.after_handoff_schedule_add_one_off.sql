CREATE OR REPLACE FUNCTION public.after_handoff_schedule_add_one_off(_program_id uuid, _property_id uuid, _source_kind text, _source_id uuid, _title text, _send_on date, _note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.after_handoff_schedule; _t text;
BEGIN
  IF NOT private.after_handoff_followup_manager() THEN RAISE EXCEPTION 'Only the Active Owner follow-up seat, the Director of Operations or an Admin can change this.'; END IF;
  _t := private.after_handoff_source_title(_source_kind,_source_id);
  IF _t IS NULL THEN RAISE EXCEPTION 'Choose an active owner task template or Library item.'; END IF;
  IF _send_on IS NULL THEN RAISE EXCEPTION 'Choose a send date.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.owner_programs op WHERE op.id=_program_id AND op.status='active' AND NOT op.is_demo AND op.archived_at IS NULL
                 AND (op.property_id=_property_id OR EXISTS (SELECT 1 FROM public.owner_program_properties pp WHERE pp.program_id=op.id AND pp.property_id=_property_id AND pp.archived_at IS NULL))) THEN
    RAISE EXCEPTION 'Choose a home in an active Active Owner program.';
  END IF;
  INSERT INTO public.after_handoff_schedule(program_id,property_id,title,source_kind,template_id,library_id,send_on,one_off,last_changed_by)
  VALUES (_program_id,_property_id,coalesce(nullif(btrim(_title),''),_t),_source_kind,
          CASE WHEN _source_kind='template' THEN _source_id END, CASE WHEN _source_kind='library' THEN _source_id END,_send_on,true,auth.uid())
  RETURNING * INTO s;
  INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,actor_id,action,new_value,note)
  VALUES (s.id,_property_id,auth.uid(),'one_off_added',jsonb_build_object('send_on',_send_on,'title',s.title),nullif(btrim(coalesce(_note,'')),''));
  RETURN s.id;
END $function$
;

