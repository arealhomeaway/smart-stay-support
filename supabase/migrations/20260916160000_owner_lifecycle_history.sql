-- Staff lifecycle, enrollment, roadmap and manual offer changes commit their
-- canonical records and history together. No legacy data is normalized.
CREATE FUNCTION private.owner_lifecycle_staff(_supervisor boolean DEFAULT true) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); BEGIN
 PERFORM 1 FROM auth.users WHERE id=actor AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled staff account is required.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=actor FOR SHARE NOWAIT;
 IF (_supervisor AND NOT(coalesce(public.has_role(actor,'admin'),false) OR coalesce(public.has_role(actor,'manager'),false)))
  OR (NOT _supervisor AND NOT coalesce(public.is_internal_staff(actor),false)) THEN RAISE EXCEPTION 'You do not have access to manage this owner program.'; END IF;
 RETURN actor;
END $$;
REVOKE ALL ON FUNCTION private.owner_lifecycle_staff(boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.owner_lifecycle_program(_program_id uuid,_expected_version uuid,_supervisor boolean DEFAULT true)
RETURNS public.owner_programs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs; actor uuid:=private.owner_lifecycle_staff(_supervisor); BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_version IS NULL OR program.report_version IS DISTINCT FROM _expected_version THEN
  RAISE EXCEPTION 'The program changed. Review the current details before saving; your draft can be kept.';
 END IF;
 IF program.archived_at IS NOT NULL OR program.status IN('closed','completed','complete') THEN RAISE EXCEPTION 'This program is no longer open for changes.'; END IF;
 IF program.is_demo AND NOT public.has_role(actor,'admin') THEN RAISE EXCEPTION 'Only an administrator can change a demo owner program.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'This program requires an active canonical Owner.'; END IF;
 RETURN program;
END $$;
REVOKE ALL ON FUNCTION private.owner_lifecycle_program(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.change_owner_program(_program_id uuid,_expected_version uuid,_action text,
 _property_id uuid DEFAULT NULL,_closing_date date DEFAULT NULL,_settings jsonb DEFAULT NULL,
 _status text DEFAULT NULL,_reason text DEFAULT NULL,_phase text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs; home public.properties; owner public.property_owners; enrollment public.owner_program_properties; lead_ids uuid[];
 template public.owner_task_templates; property_ids uuid[]; target_id uuid; review_id uuid; added integer:=0; kind text; summary text;
 previous_value text; new_value text; detail jsonb:='{}'::jsonb; actor uuid:=auth.uid(); allowed boolean;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text) TO authenticated;

CREATE FUNCTION public.create_owner_program(_property_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=private.owner_lifecycle_staff(true); home public.properties; owner public.property_owners;
 program public.owner_programs; included_program uuid; result jsonb;
BEGIN
 -- Creation has no program to lock yet. Serialize by canonical Owner, then fail
 -- fast if a concurrent existing-program action holds an inverse lock.
 SELECT * INTO home FROM public.properties WHERE id=_property_id;
 IF NOT FOUND OR home.owner_record_id IS NULL OR home.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Link this current Property to its canonical Owner before enrolling it.'; END IF;
 SELECT * INTO owner FROM public.property_owners WHERE id=home.owner_record_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR NOT owner.active THEN RAISE EXCEPTION 'Enrollment requires an active canonical Owner.'; END IF;
 SELECT * INTO program FROM public.owner_programs p WHERE p.owner_record_id=owner.id AND p.is_demo=home.is_demo AND p.archived_at IS NULL AND p.status NOT IN('closed','completed','complete') FOR UPDATE NOWAIT;
 SELECT h.* INTO home FROM public.properties h WHERE h.id=_property_id AND h.owner_record_id=owner.id AND h.is_demo=home.is_demo AND h.archived_at IS NULL FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Property Owner or demo mode changed. Review enrollment again.'; END IF;
 IF home.is_demo AND NOT public.has_role(actor,'admin') THEN RAISE EXCEPTION 'Only an administrator can create a demo owner program.'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.create_owner_program(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_owner_program(uuid) TO authenticated;

CREATE FUNCTION public.create_owner_opportunity(_program_id uuid,_expected_version uuid,_expected_owner_id uuid,
 _source text,_source_id uuid,_expected_source_updated_at timestamptz,_title text,_instructions text,_action_type text,
 _available_from timestamptz,_respond_by date,_staff_context text,_reviewed boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs; home public.properties; task public.onboarding_tasks; ticket public.tickets;
 property_id uuid; source_updated timestamptz; source_demo boolean; source_stage text; opportunity_id uuid;
BEGIN
 program:=private.owner_lifecycle_program(_program_id,_expected_version,false);
 IF program.owner_record_id IS DISTINCT FROM _expected_owner_id THEN RAISE EXCEPTION 'The canonical Owner changed. Review the opportunity again.'; END IF;
 IF _source='onboarding' THEN
  SELECT * INTO task FROM public.onboarding_tasks WHERE id=_source_id FOR SHARE NOWAIT;
  IF NOT FOUND OR task.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This onboarding work is no longer available.'; END IF;
  property_id:=task.property_id; source_updated:=task.updated_at; source_demo:=task.is_demo; source_stage:=coalesce(task.stage,'onboarding');
 ELSIF _source='operations' THEN
  SELECT * INTO ticket FROM public.tickets WHERE id=_source_id FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'This Ticket is no longer available.'; END IF;
  property_id:=ticket.property_id; source_updated:=ticket.updated_at; source_demo:=ticket.is_demo; source_stage:='operations';
 ELSE RAISE EXCEPTION 'Choose existing onboarding work or an operational Ticket.'; END IF;
 IF _expected_source_updated_at IS NULL OR source_updated IS DISTINCT FROM _expected_source_updated_at THEN RAISE EXCEPTION 'The source work changed. Review its current context before offering it.'; END IF;
 SELECT * INTO home FROM public.properties WHERE id=property_id FOR SHARE NOWAIT;
 IF NOT FOUND OR home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM program.owner_record_id
  OR home.is_demo IS DISTINCT FROM program.is_demo OR source_demo IS DISTINCT FROM program.is_demo THEN
  RAISE EXCEPTION 'This work must belong to a current Property with the same canonical Owner and demo mode as its program.';
 END IF;
 PERFORM 1 FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.property_id=home.id AND e.inclusion_status='included'
  AND e.archived_at IS NULL AND e.is_demo=program.is_demo FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'This Property is no longer included in the program.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_reviews r WHERE (_source='onboarding' AND r.onboarding_task_id=_source_id)
  OR (_source='operations' AND r.program_id=program.id AND r.ticket_id=_source_id)) THEN RAISE EXCEPTION 'This work has already been offered to the homeowner. Refresh to open the existing opportunity.'; END IF;
 IF _reviewed IS DISTINCT FROM true OR length(trim(coalesce(_title,''))) NOT BETWEEN 3 AND 200 OR length(trim(coalesce(_instructions,''))) NOT BETWEEN 3 AND 2000
  OR length(coalesce(_staff_context,''))>1000 OR _action_type IS NULL OR _action_type NOT IN('approve_only','review_comment','review_decide','provide_information','attend_respond','action_payment','information_only','research_recommend') THEN
  RAISE EXCEPTION 'Review the owner-facing title, explanation and Welcome Packet request type before offering this opportunity.';
 END IF;
 IF (_available_from IS NOT NULL AND NOT isfinite(_available_from)) OR (_respond_by IS NOT NULL AND (NOT isfinite(_respond_by) OR (_available_from IS NOT NULL AND _respond_by<_available_from::date))) THEN
  RAISE EXCEPTION 'The response date must be on or after availability.';
 END IF;
 INSERT INTO public.owner_reviews(program_id,property_id,task_type,source_type,onboarding_task_id,ticket_id,owner_action_type,available_from,respond_by,
  staff_context,phase,stage,title,recommendation,business_question,decision_path,status,created_by,is_demo)
 VALUES(program.id,home.id,'property_specific',_source,CASE WHEN _source='onboarding' THEN _source_id END,CASE WHEN _source='operations' THEN _source_id END,
  _action_type,_available_from,_respond_by,nullif(trim(_staff_context),''),CASE WHEN _source='onboarding' THEN 'onboarding' ELSE 'ongoing' END,source_stage,
  trim(_title),trim(_instructions),trim(_instructions),CASE WHEN _action_type='approve_only' THEN 'approve' WHEN _action_type='information_only' THEN 'inform' ELSE 'consult' END,
  'awaiting_owner',auth.uid(),program.is_demo) RETURNING id INTO opportunity_id;
 INSERT INTO public.owner_review_properties(review_id,property_id) VALUES(opportunity_id,home.id);
 INSERT INTO public.owner_program_events(program_id,property_id,review_id,kind,summary,actor_id,detail)
 VALUES(program.id,home.id,opportunity_id,'opportunity_created','Participation opportunity offered.',auth.uid(),
  jsonb_build_object('reviewedVersion',_expected_version,'source',_source,'sourceId',_source_id,'sourceUpdatedAt',_expected_source_updated_at,'privacyReviewed',true));
 RETURN opportunity_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or source work is being updated. Refresh and review the current opportunity context.';
END $$;
REVOKE ALL ON FUNCTION public.create_owner_opportunity(uuid,uuid,uuid,text,uuid,timestamptz,text,text,text,timestamptz,date,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_owner_opportunity(uuid,uuid,uuid,text,uuid,timestamptz,text,text,text,timestamptz,date,text,boolean) TO authenticated;

CREATE FUNCTION public.owner_program_staff_choices() RETURNS TABLE(id uuid,label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_internal_staff(auth.uid()),false) OR NOT EXISTS(SELECT 1 FROM auth.users current_actor WHERE current_actor.id=auth.uid() AND current_actor.deleted_at IS NULL AND (current_actor.banned_until IS NULL OR current_actor.banned_until<=now())) THEN RAISE EXCEPTION 'Enabled staff access is required.'; END IF;
 RETURN QUERY SELECT a.id,coalesce(nullif(p.full_name,''),a.email,'Staff member') FROM auth.users a LEFT JOIN public.profiles p ON p.id=a.id
 WHERE a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now()) AND public.is_internal_staff(a.id) ORDER BY a.id;
END $$;
REVOKE ALL ON FUNCTION public.owner_program_staff_choices() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_program_staff_choices() TO authenticated;

-- Closing the phantom-role gap: every role insertion, removal or reassignment
-- locks the same account rows already held SHARE by authorized owner writers.
CREATE FUNCTION private.serialize_owner_account_roles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE account_ids uuid[]; account_id uuid; BEGIN
 IF TG_OP='INSERT' THEN account_ids:=ARRAY[NEW.user_id]; ELSIF TG_OP='DELETE' THEN account_ids:=ARRAY[OLD.user_id]; ELSE account_ids:=ARRAY[OLD.user_id,NEW.user_id]; END IF;
 FOR account_id IN SELECT DISTINCT id FROM unnest(account_ids) id WHERE id IS NOT NULL ORDER BY id LOOP
  PERFORM 1 FROM auth.users WHERE id=account_id FOR UPDATE NOWAIT;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'This account has an action in progress. Retry the role change after that action finishes.';
END $$;
REVOKE ALL ON FUNCTION private.serialize_owner_account_roles() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER serialize_owner_account_roles BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION private.serialize_owner_account_roles();

CREATE OR REPLACE FUNCTION public.complete_owner_program(_program_id uuid,_actor_id uuid,_expected_version uuid,_report jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_version IS NULL OR program.report_version IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'The program or its report inputs changed. Refresh before completing it.'; END IF;
 PERFORM 1 FROM auth.users WHERE id=_actor_id AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled supervisor account is required for closeout.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=_actor_id FOR SHARE NOWAIT;
 IF NOT(coalesce(public.has_role(_actor_id,'admin'),false) OR coalesce(public.has_role(_actor_id,'manager'),false))
  OR (program.is_demo AND NOT coalesce(public.has_role(_actor_id,'admin'),false)) THEN RAISE EXCEPTION 'Only an authorized supervisor can complete this program.'; END IF;
 IF program.archived_at IS NOT NULL OR program.status NOT IN('active','target_reached') OR program.completed_at IS NOT NULL OR program.completion_report IS NOT NULL THEN
  RAISE EXCEPTION 'Only a current active program can be completed once.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Closeout requires the active canonical Owner.'; END IF;
 IF _report IS NULL OR jsonb_typeof(_report) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'A generated closeout report is required.'; END IF;
 UPDATE public.owner_programs SET status='completed',completed_at=now(),completed_by=_actor_id,completion_report=_report WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,detail)
 VALUES(program.id,'program_completed','ARHA completed the formal program closeout.',_actor_id,jsonb_build_object('reportVersion',_expected_version));
 RETURN program.id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or account is being updated. Refresh before completing it.';
END $$;
REVOKE ALL ON FUNCTION public.complete_owner_program(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_owner_program(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.close_owner_opportunity(
 _review_id uuid,_expected_updated_at timestamptz,_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE review public.owner_reviews; program public.owner_programs;
BEGIN
 PERFORM private.owner_lifecycle_staff(false);
 IF length(trim(coalesce(_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Explain why this participation opportunity is being withdrawn.';
 END IF;
 SELECT p.* INTO program FROM public.owner_programs p
 JOIN public.owner_reviews r ON r.program_id=p.id WHERE r.id=_review_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'This opportunity is not available.'; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=program.id FOR UPDATE NOWAIT;
 IF NOT FOUND OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed') THEN
  RAISE EXCEPTION 'This participation program is no longer open for changes.';
 END IF;
 IF program.is_demo AND NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Only an administrator may change a demo program.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'This program needs an active canonical Owner.'; END IF;
 SELECT * INTO review FROM public.owner_reviews WHERE id=_review_id AND program_id=program.id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_updated_at IS NULL OR review.updated_at IS DISTINCT FROM _expected_updated_at THEN
  RAISE EXCEPTION 'The opportunity changed. Refresh before closing it.';
 END IF;
 IF review.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'This opportunity does not match its program.'; END IF;
 IF review.auto_ticket OR review.ticket_id IS NOT NULL THEN
  RAISE EXCEPTION 'Ticket opportunities stay available for owner review and participation; they cannot be withdrawn manually.';
 END IF;
 IF review.status='answered' OR review.responded_at IS NOT NULL THEN
  RAISE EXCEPTION 'This opportunity already has an owner response and stays in the owner''s record.';
 END IF;
 IF review.status='closed' THEN RAISE EXCEPTION 'This opportunity is already closed.'; END IF;
 UPDATE public.owner_reviews SET status='closed',closed_at=now(),updated_at=clock_timestamp() WHERE id=review.id;
 INSERT INTO public.owner_program_events(program_id,property_id,review_id,kind,summary,actor_id,reason,previous_value,new_value)
 VALUES(program.id,review.property_id,review.id,'opportunity_closed','Participation opportunity withdrawn by staff.',
  auth.uid(),trim(_reason),review.status,'closed');
 RETURN review.id;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This opportunity is being updated. Refresh and try closing it again.';
END $$;
REVOKE ALL ON FUNCTION public.close_owner_opportunity(uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_owner_opportunity(uuid,timestamptz,text) TO authenticated,service_role;

-- Direct service writes must not relink a real owner account outside redemption.
CREATE OR REPLACE FUNCTION public.guard_owner_account_link() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.owner_user_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN RETURN NEW; END IF;
 IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.redeem_owner_invite(uuid,text)'::regprocedure) THEN
  RAISE EXCEPTION 'Link the owner account through the atomic invitation action.';
 END IF;
 RETURN NEW;
END $$;

-- Fail closed before installing write guards if an existing checked writer was
-- created under a different owner. This migration never changes function owners.
DO $$ DECLARE writer_owner oid; BEGIN
 SELECT proowner INTO writer_owner FROM pg_proc WHERE oid='public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure;
 IF writer_owner::regrole::text IN('anon','authenticated','service_role','authenticator') OR EXISTS(SELECT 1 FROM pg_proc WHERE oid IN(
  'public.create_owner_program(uuid)'::regprocedure,
  'public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure,
  'public.create_owner_opportunity(uuid,uuid,uuid,text,uuid,timestamptz,text,text,text,timestamptz,date,text,boolean)'::regprocedure,
  'public.complete_owner_program(uuid,uuid,uuid,jsonb)'::regprocedure,
  'public.activate_owner_program(uuid,uuid,date)'::regprocedure,
  'public.redeem_owner_invite(uuid,text)'::regprocedure,
  'public.close_owner_opportunity(uuid,timestamptz,text)'::regprocedure,
  'public.respond_owner_review(uuid,timestamptz,text,text,integer)'::regprocedure,
  'public.sync_ticket_opportunities(uuid,uuid)'::regprocedure,
  'public.refresh_owner_badges(uuid,uuid,uuid)'::regprocedure
 ) AND (NOT prosecdef OR proowner<>writer_owner)) THEN
  RAISE EXCEPTION 'Owner lifecycle boundary requires checked functions under one trusted non-application owner. No ownership is changed by this migration.';
 END IF;
END $$;

CREATE FUNCTION private.guard_owner_lifecycle_writes() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE trusted boolean:=current_user=(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure);
 changed boolean; review public.owner_reviews; BEGIN
 IF TG_TABLE_NAME='owner_programs' THEN
  IF TG_OP='UPDATE' AND OLD.completion_report IS NOT NULL AND (NEW.completion_report IS DISTINCT FROM OLD.completion_report OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
   OR NEW.completed_by IS DISTINCT FROM OLD.completed_by OR NEW.status IS DISTINCT FROM OLD.status) THEN RAISE EXCEPTION 'The saved closeout report and completed lifecycle are immutable.'; END IF;
  IF TG_OP='UPDATE' AND (NEW.owner_record_id IS DISTINCT FROM OLD.owner_record_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo)
   AND (OLD.owner_record_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_program_events e WHERE e.program_id=OLD.id)) THEN RAISE EXCEPTION 'Preserve the program canonical Owner, original Property and demo identity.'; END IF;
  IF TG_OP='UPDATE' THEN
   changed:=(to_jsonb(NEW)-ARRAY['updated_at','report_version','last_owner_activity_at','notify_email','notify_sms_p1','notify_push','owner_phone','owner_user_id'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','report_version','last_owner_activity_at','notify_email','notify_sms_p1','notify_push','owner_phone','owner_user_id']);
  ELSE changed:=true; END IF;
  IF TG_OP='DELETE' AND NOT(OLD.is_demo AND trusted AND coalesce(public.has_role(auth.uid(),'admin'),false)) THEN RAISE EXCEPTION 'Retain program history; archive through a reviewed lifecycle action.'; END IF;
  IF changed AND NOT trusted THEN RAISE EXCEPTION 'Change owner program lifecycle and setup through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_program_properties' THEN
  IF TG_OP='UPDATE' AND (NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo) THEN RAISE EXCEPTION 'Enrollment identity is immutable. Retain its history.'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Remove enrollment without deleting its history.'; END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change owner enrollment through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_reviews' THEN
  IF TG_OP='UPDATE' AND NEW.auto_ticket IS DISTINCT FROM OLD.auto_ticket THEN RAISE EXCEPTION 'Preserve the published opportunity source and revision model.'; END IF;
  -- Manual/roadmap content is published on insertion and has no revision editor.
  -- Automatic Ticket projections retain their separate immutable update receipts.
  IF TG_OP='UPDATE' AND NOT OLD.auto_ticket AND (
   (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(NEW)) WHERE key=ANY(ARRAY['title','business_question','recommendation','evidence','impact','outcome','photos','attachment_path','owner_action_type','decision_path']))
   IS DISTINCT FROM
   (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(OLD)) WHERE key=ANY(ARRAY['title','business_question','recommendation','evidence','impact','outcome','photos','attachment_path','owner_action_type','decision_path']))
  ) THEN RAISE EXCEPTION 'Published manual opportunity context is immutable. Preserve the narrative the owner reviewed.'; END IF;
  IF TG_OP IN('UPDATE','DELETE') AND (OLD.responded_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_time_entries t WHERE t.review_id=OLD.id)) THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain the opportunity and its participation history.'; END IF;
   IF NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
    OR NEW.onboarding_task_id IS DISTINCT FROM OLD.onboarding_task_id OR NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'The source and Property identity of participated opportunities are immutable.';
   END IF;
  END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change owner opportunities through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_review_properties' THEN
  SELECT * INTO review FROM public.owner_reviews WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.review_id ELSE NEW.review_id END;
  IF review.responded_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_time_entries t WHERE t.review_id=review.id) THEN
   IF TG_OP<>'INSERT' OR NOT EXISTS(SELECT 1 FROM public.owner_review_properties p WHERE p.review_id=NEW.review_id AND p.property_id=NEW.property_id) THEN
    RAISE EXCEPTION 'Retain the Property links of participated opportunities.';
   END IF;
  END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change opportunity Property links through the checked atomic actions.'; END IF;
 ELSE
  IF TG_OP IN('UPDATE','DELETE') THEN RAISE EXCEPTION 'Owner program history is immutable.'; END IF;
  IF NEW.kind IN('program_created','property_added','property_removed','closing_confirmed','program_updated','status_changed','roadmap_seeded','opportunity_created','opportunity_closed','program_completed','program_activated')
   AND NOT trusted THEN RAISE EXCEPTION 'Record lifecycle history through the checked atomic action.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_owner_lifecycle_writes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER owner_program_lifecycle_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.owner_programs FOR EACH ROW EXECUTE FUNCTION private.guard_owner_lifecycle_writes();
CREATE TRIGGER owner_enrollment_write_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION private.guard_owner_lifecycle_writes();
CREATE TRIGGER owner_opportunity_write_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.owner_reviews FOR EACH ROW EXECUTE FUNCTION private.guard_owner_lifecycle_writes();
CREATE TRIGGER owner_review_property_write_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.owner_review_properties FOR EACH ROW EXECUTE FUNCTION private.guard_owner_lifecycle_writes();
CREATE TRIGGER owner_lifecycle_history_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.owner_program_events FOR EACH ROW EXECUTE FUNCTION private.guard_owner_lifecycle_writes();
