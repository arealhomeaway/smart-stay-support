CREATE OR REPLACE FUNCTION public.create_owner_program(_property_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE actor uuid:=private.owner_lifecycle_staff(true); home public.properties; owner public.property_owners;
 program public.owner_programs; included_program uuid; result jsonb;
BEGIN
 IF NOT private.is_active_owner_authority(actor) THEN RAISE EXCEPTION 'Only the Onboarding Director or a Platform Owner can enroll a home in Active Owner.'; END IF;
 IF coalesce(private.is_synthetic_account(),false) AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=_property_id AND is_demo IS TRUE) THEN RAISE EXCEPTION 'Test accounts can only enroll demo homes.'; END IF;
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
END $function$
;

