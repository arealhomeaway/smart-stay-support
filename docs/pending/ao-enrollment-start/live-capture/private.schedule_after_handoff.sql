CREATE OR REPLACE FUNCTION private.schedule_after_handoff(_project_id uuid, _property_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _program uuid; _demo boolean; _accept_day date; _n integer;
BEGIN
  SELECT coalesce(is_demo,false) INTO _demo FROM public.properties WHERE id=_property_id;
  IF coalesce(_demo,false) THEN RETURN 0; END IF;
  SELECT op.id INTO _program FROM public.owner_programs op
  WHERE op.status='active' AND NOT op.is_demo AND op.archived_at IS NULL
    AND (op.property_id=_property_id OR EXISTS (SELECT 1 FROM public.owner_program_properties pp
         WHERE pp.program_id=op.id AND pp.property_id=_property_id AND pp.archived_at IS NULL AND NOT pp.is_demo))
  ORDER BY op.created_at DESC LIMIT 1;
  IF _program IS NULL THEN
    INSERT INTO public.after_handoff_schedule_events(property_id,project_id,actor_id,action,note)
    VALUES (_property_id,_project_id,auth.uid(),'no_program','No Active Owner program at handoff; nothing scheduled');
    RETURN 0;
  END IF;
  _accept_day := (now() AT TIME ZONE 'America/Chicago')::date;
  INSERT INTO public.after_handoff_schedule_events(property_id,project_id,actor_id,action,new_value,note)
  SELECT _property_id,_project_id,auth.uid(),'skipped_covered',jsonb_build_object('plan_item_id',p.id,'card_code',p.covered_card_code),'Covered by a card on this home''s plan'
  FROM public.after_handoff_plan_items p WHERE p.active AND p.coverage='covered_by_card'
    AND EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards lc ON lc.id=pc.card_id
                WHERE pc.property_id=_property_id AND lc.code=p.covered_card_code AND pc.join_outcome IN ('locked','open'))
    AND NOT EXISTS (SELECT 1 FROM public.after_handoff_schedule s WHERE s.property_id=_property_id AND s.plan_item_id=p.id);
  WITH ins AS (
    INSERT INTO public.after_handoff_schedule(program_id,property_id,project_id,plan_item_id,title,source_kind,template_id,library_id,send_on,last_changed_by)
    SELECT _program,_property_id,_project_id,p.id,p.title,p.source_kind,p.template_id,p.library_id,_accept_day+p.send_after_days,auth.uid()
    FROM public.after_handoff_plan_items p WHERE p.active
      AND NOT (p.coverage='covered_by_card' AND EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards lc ON lc.id=pc.card_id
               WHERE pc.property_id=_property_id AND lc.code=p.covered_card_code AND pc.join_outcome IN ('locked','open')))
    ORDER BY p.send_after_days, p.sort_order
    ON CONFLICT (property_id, plan_item_id) DO NOTHING
    RETURNING *
  ), ev AS (
    INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,project_id,actor_id,action,new_value,note)
    SELECT ins.id,_property_id,_project_id,auth.uid(),'scheduled',jsonb_build_object('send_on',ins.send_on,'status','scheduled'),'Scheduled at handoff acceptance'
    FROM ins RETURNING 1
  ) SELECT count(*) INTO _n FROM ev;
  RETURN _n;
END $function$
;

