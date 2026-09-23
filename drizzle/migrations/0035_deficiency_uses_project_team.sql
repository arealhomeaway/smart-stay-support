CREATE OR REPLACE FUNCTION public.log_handoff_deficiency(_project_id uuid, _title text, _detail text, _role text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pr onboarding_projects; new_id uuid; who uuid;
BEGIN
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id;
  IF pr.id IS NULL OR pr.handoff_state <> 'ready' THEN RAISE EXCEPTION 'Deficiencies are logged on homes marked Ready for Operations.'; END IF;
  IF NOT (auth.uid() = public.seat_holder('director_ops') OR public.has_role(auth.uid(),'admin') OR public.is_supervisor(auth.uid())) THEN
    RAISE EXCEPTION 'Only Operations leadership can log a handoff deficiency.';
  END IF;
  IF length(trim(coalesce(_title,''))) < 3 THEN RAISE EXCEPTION 'Describe the deficiency.'; END IF;
  who := public.project_role_assignee(_project_id, coalesce(_role,'onboarding_project_manager'));
  INSERT INTO onboarding_tasks(property_id,stage,title,detail,assigned_to,assigned_seat,status,blocks_handoff,is_required,tags,due_on,due_on_source,created_by,is_demo)
  VALUES (pr.property_id,'Handoff deficiencies',trim(_title),nullif(trim(coalesce(_detail,'')),''),who,coalesce(_role,'onboarding_project_manager'),
          'open',true,true,ARRAY['deficiency'],current_date+2,'handoff_deficiency',auth.uid(),pr.is_demo)
  RETURNING id INTO new_id;
  RETURN new_id;
END $function$;