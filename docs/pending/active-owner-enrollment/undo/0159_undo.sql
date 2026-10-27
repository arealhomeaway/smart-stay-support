-- UNDO 0159: restore activation/add-home baselines and drop the enrollment step machinery.
-- activate_owner_program 83253cd4bb3e588d4de6f1e90bc803dc21adf9c0700ab46487827880d8f38a0c
CREATE OR REPLACE FUNCTION public.activate_owner_program(_program_id uuid, _expected_version uuid, _started_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$


-- change_owner_program 47c61b73e8e085ef660823c3c27771307b5ea121c2f6f70e7aa1a42f303fb1df
CREATE OR REPLACE FUNCTION public.change_owner_program(_program_id uuid, _expected_version uuid, _action text, _property_id uuid DEFAULT NULL::uuid, _closing_date date DEFAULT NULL::date, _settings jsonb DEFAULT NULL::jsonb, _status text DEFAULT NULL::text, _reason text DEFAULT NULL::text, _phase text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; home public.properties; owner public.property_owners; enrollment public.owner_program_properties; lead_ids uuid[];
 template public.owner_task_templates; property_ids uuid[]; target_id uuid; review_id uuid; added integer:=0; kind text; summary text;
 previous_value text; new_value text; detail jsonb:='{}'::jsonb; actor uuid:=auth.uid(); allowed boolean;
BEGIN
 IF _action='add_property' AND NOT private.is_active_owner_authority(auth.uid()) THEN RAISE EXCEPTION 'Only the Onboarding Director or a Platform Owner can enroll a home in Active Owner.'; END IF;
 IF _action='add_property' AND coalesce(private.is_synthetic_account(),false) AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=_property_id AND is_demo IS TRUE) THEN RAISE EXCEPTION 'Test accounts can only add demo homes.'; END IF;
 program:=private.owner_lifecycle_program(_program_id,_expected_version,true);
 IF _action IN('add_property','remove_property','confirm_closing') THEN
  SELECT * INTO home FROM public.properties WHERE id=_property_id FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'The Property is not available.'; END IF;
  SELECT * INTO enrollment FROM public.owner_program_properties WHERE program_id=program.id AND property_id=home.id FOR UPDATE NOWAIT;
  IF _action='add_property' THEN
   IF home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.is_demo IS DISTINCT FROM program.is_demo THEN
    RAISE EXCEPTION 'This Property and program must have the same current canonical Owner and demo mode.';
   END IF;
   IF EXISTS(SELECT 1 FROM public.owner_program_properties e WHERE e.property_id=home.id AND e.inclusion_status='included') THEN
    RAISE EXCEPTION 'That Property is already part of a participation program.';
   END IF;
   IF enrollment.program_id IS NOT NULL THEN RAISE EXCEPTION 'This Property already has retained enrollment history. Review that record before changing enrollment.'; END IF;
   IF _closing_date IS NOT NULL AND (NOT isfinite(_closing_date) OR _closing_date>current_date) THEN RAISE EXCEPTION 'Choose a confirmed closing date no later than today.'; END IF;
   IF program.started_on IS NOT NULL AND (NOT public.has_role(actor,'admin') OR _closing_date IS NULL) THEN
    RAISE EXCEPTION 'Adding a Property after activation requires an administrator and its confirmed closing date.';
   END IF;
   INSERT INTO public.owner_program_properties(program_id,property_id,closing_date,closing_confirmed,added_by,added_on,is_demo)
    VALUES(program.id,home.id,_closing_date,_closing_date IS NOT NULL,actor,current_date,program.is_demo);
   kind:='property_added'; summary:=CASE WHEN program.started_on IS NULL THEN 'Property added to the program.' ELSE 'Property added after activation. The 90-day timeline and combined target are unchanged.' END;
   detail:=jsonb_build_object('closingDate',_closing_date);
  ELSIF _action='remove_property' THEN
   IF enrollment.program_id IS NULL OR enrollment.inclusion_status<>'included' OR enrollment.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This Property is not currently included in the program.'; END IF;
   IF length(trim(coalesce(_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Explain why this Property is being removed.'; END IF;
   IF (SELECT count(*) FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.inclusion_status='included' AND e.archived_at IS NULL)<=1 THEN
    RAISE EXCEPTION 'Keep at least one included Property in this program.';
   END IF;
   UPDATE public.owner_program_properties SET inclusion_status='removed' WHERE program_id=program.id AND property_id=home.id;
   kind:='property_removed'; summary:='Property removed from the program. Its history is preserved.'; previous_value:='included'; new_value:='removed';
  ELSE
   IF enrollment.program_id IS NULL OR enrollment.inclusion_status<>'included' OR enrollment.archived_at IS NOT NULL
    OR home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.is_demo IS DISTINCT FROM program.is_demo THEN
    RAISE EXCEPTION 'Confirm closing only for a current canonical Property included in this program.';
   END IF;
   IF _closing_date IS NULL OR NOT isfinite(_closing_date) OR _closing_date>current_date OR (program.started_on IS NOT NULL AND _closing_date>program.started_on) THEN
    RAISE EXCEPTION 'Choose a confirmed closing date no later than today or the existing program start.';
   END IF;
   previous_value:=enrollment.closing_date::text; new_value:=_closing_date::text;
   UPDATE public.owner_program_properties SET closing_date=_closing_date,closing_confirmed=true WHERE program_id=program.id AND property_id=home.id;
   kind:='closing_confirmed'; summary:='Property closing confirmed.';
  END IF;
 ELSIF _action='settings' THEN
  IF _settings IS NULL OR jsonb_typeof(_settings)<>'object' OR NOT(_settings ? 'dfyConfirmed') OR jsonb_typeof(_settings->'dfyConfirmed')<>'boolean'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(_settings) key WHERE key NOT IN('onboardingLead','operationsLead','dfyConfirmed','internalNotes'))
   OR length(coalesce(_settings->>'onboardingLead',''))>120 OR length(coalesce(_settings->>'operationsLead',''))>120 OR length(coalesce(_settings->>'internalNotes',''))>4000 THEN
   RAISE EXCEPTION 'Provide valid program leads, DFY confirmation and internal notes. Owner identity comes from the canonical Owner record.';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(_settings) value WHERE key IN('onboardingLead','operationsLead') AND value<>'null'::jsonb
   AND (jsonb_typeof(value)<>'string' OR (value#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) THEN RAISE EXCEPTION 'Choose leads from the current staff account list.'; END IF;
  lead_ids:=ARRAY[nullif(_settings->>'onboardingLead','')::uuid,nullif(_settings->>'operationsLead','')::uuid];
  PERFORM a.id FROM auth.users a WHERE a.id=ANY(lead_ids) ORDER BY a.id FOR SHARE NOWAIT;
  PERFORM 1 FROM public.user_roles WHERE user_id=ANY(lead_ids) FOR SHARE NOWAIT;
  IF EXISTS(SELECT 1 FROM unnest(lead_ids) chosen WHERE chosen IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=chosen AND a.deleted_at IS NULL
   AND (a.banned_until IS NULL OR a.banned_until<=now()) AND public.is_internal_staff(a.id))) THEN RAISE EXCEPTION 'Program leads must be current enabled staff accounts.'; END IF;
  SELECT * INTO owner FROM public.property_owners WHERE id=program.owner_record_id;
  UPDATE public.owner_programs SET owner_name=owner.name,owner_email=owner.email,
   onboarding_lead=nullif(trim(_settings->>'onboardingLead'),'')::uuid,operations_lead=nullif(trim(_settings->>'operationsLead'),'')::uuid,
   dfy_confirmed=(_settings->>'dfyConfirmed')::boolean,
   dfy_confirmed_at=CASE WHEN (_settings->>'dfyConfirmed')::boolean THEN coalesce(dfy_confirmed_at,now()) ELSE NULL END,
   internal_notes=nullif(trim(_settings->>'internalNotes'),'') WHERE id=program.id;
  kind:='program_updated'; summary:='Program details updated.';
  detail:=jsonb_build_object('dfyConfirmed',(_settings->>'dfyConfirmed')::boolean,'priorDfyConfirmed',program.dfy_confirmed);
 ELSIF _action='status' THEN
  allowed:=((program.status IN('draft','pending','waiting_for_closing','ready_for_onboarding') AND program.started_on IS NULL
    AND _status IN('draft','pending','waiting_for_closing','ready_for_onboarding'))
   OR (program.status IN('active','target_reached') AND _status='paused')
   OR (program.status='paused' AND program.started_on IS NOT NULL AND _status='active'));
  IF NOT coalesce(allowed,false) THEN RAISE EXCEPTION 'Use the activation or completion checklist for this lifecycle change.'; END IF;
  UPDATE public.owner_programs SET status=_status WHERE id=program.id;
  kind:='status_changed'; summary:='Program status changed.'; previous_value:=program.status; new_value:=_status;
 ELSIF _action='seed_roadmap' THEN
  IF _phase IS NULL OR _phase NOT IN('onboarding','ongoing','all') THEN RAISE EXCEPTION 'Choose a roadmap phase.'; END IF;
  PERFORM 1 FROM public.owner_program_properties e WHERE e.program_id=program.id ORDER BY e.property_id FOR SHARE NOWAIT;
  PERFORM h.id FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id AND e.program_id=program.id
   WHERE e.inclusion_status='included' ORDER BY h.id FOR SHARE OF h NOWAIT;
  IF EXISTS(SELECT 1 FROM public.owner_program_properties e LEFT JOIN public.properties h ON h.id=e.property_id WHERE e.program_id=program.id AND e.inclusion_status='included'
   AND (e.archived_at IS NOT NULL OR e.is_demo IS DISTINCT FROM program.is_demo OR h.id IS NULL OR h.archived_at IS NOT NULL OR h.owner_record_id IS DISTINCT FROM program.owner_record_id OR h.is_demo IS DISTINCT FROM program.is_demo)) THEN
   RAISE EXCEPTION 'Every included Property must match the current canonical Owner and demo mode before releasing activities.';
  END IF;
  SELECT array_agg(e.property_id ORDER BY e.property_id) INTO property_ids FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.inclusion_status='included';
  FOR template IN SELECT * FROM public.owner_task_templates t WHERE t.active AND (_phase='all' OR t.phase=_phase) ORDER BY t.sort_order,t.id FOR SHARE NOWAIT LOOP
   FOREACH target_id IN ARRAY CASE WHEN template.phase='onboarding' AND cardinality(property_ids)>0 THEN property_ids ELSE ARRAY[NULL::uuid] END LOOP
    IF EXISTS(SELECT 1 FROM public.owner_reviews r WHERE r.program_id=program.id AND r.template_id=template.id AND r.property_id IS NOT DISTINCT FROM target_id) THEN CONTINUE; END IF;
    INSERT INTO public.owner_reviews(program_id,template_id,property_id,task_type,phase,stage,title,business_question,recommendation,impact,decision_path,
     owner_action_type,respond_by,status,sort_order,created_by,is_demo)
    VALUES(program.id,template.id,target_id,CASE WHEN target_id IS NULL THEN 'program_wide' ELSE 'property_specific' END,template.phase,template.stage,template.title,
     template.summary,template.summary,template.owner_action,template.decision_path,template.owner_action_type,
     coalesce(program.started_on,current_date)+template.respond_within_days,'prepared',template.sort_order,actor,program.is_demo) RETURNING id INTO review_id;
    IF target_id IS NOT NULL THEN INSERT INTO public.owner_review_properties(review_id,property_id) VALUES(review_id,target_id); END IF;
    added:=added+1;
   END LOOP;
  END LOOP;
  IF added=0 THEN RETURN jsonb_build_object('programId',program.id,'added',0,'reportVersion',program.report_version); END IF;
  kind:='roadmap_seeded'; summary:=added||' owner activities released.'; detail:=jsonb_build_object('phase',_phase,'added',added);
 ELSE RAISE EXCEPTION 'Unknown program action.';
 END IF;
 INSERT INTO public.owner_program_events(program_id,property_id,kind,summary,actor_id,previous_value,new_value,reason,detail)
 VALUES(program.id,CASE WHEN _action IN('add_property','remove_property','confirm_closing') THEN _property_id END,kind,summary,actor,previous_value,new_value,
  CASE WHEN _action='remove_property' THEN trim(_reason) END,detail||jsonb_build_object('reviewedVersion',_expected_version));
 RETURN jsonb_build_object('programId',program.id,'added',added,'reportVersion',(SELECT report_version FROM public.owner_programs WHERE id=program.id));
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'This program or Property is being updated. Refresh and review the current details before saving.';
END $function$


DROP FUNCTION IF EXISTS public.active_owner_enrollment_step(uuid,text,jsonb,uuid);
DROP TABLE IF EXISTS public.active_owner_enrollment_runs;
