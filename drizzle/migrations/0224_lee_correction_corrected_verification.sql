CREATE OR REPLACE FUNCTION public.apply_lee_homeowner_correction(_undo boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $function$
DECLARE p public.owner_programs; f public.profiles; w uuid; membership uuid; inv public.team_invites; before_profile jsonb;
 summary_text text:='Main homeowner changed to Ryan Lee; Lindsey Lee added as co-owner';
BEGIN
 IF auth.uid() IS DISTINCT FROM '98bd6696-4018-4965-b645-0471c5ae3925'::uuid OR NOT public.has_role(auth.uid(),'admin') OR private.is_synthetic_account() THEN
  RAISE EXCEPTION 'Only Emily as an Admin may run this approved correction.';
 END IF;
 SELECT * INTO p FROM public.owner_programs WHERE id='814b9c32-0910-499b-b4ac-2c7fc026569b' FOR UPDATE;
 IF NOT FOUND OR p.is_demo OR p.archived_at IS NOT NULL OR p.status<>'active' OR p.owner_record_id<>'325b28ae-f24e-4950-b42b-a05fbacef548' OR p.property_id<>'8decd427-35f5-43ca-afa2-ee916f98fb95' THEN RAISE EXCEPTION 'The approved home or program changed.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=p.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'An active canonical Owner is required.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_program_properties e JOIN public.properties h ON h.id=e.property_id WHERE e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND (e.is_demo OR h.is_demo OR h.archived_at IS NOT NULL OR h.owner_record_id IS DISTINCT FROM p.owner_record_id)) THEN RAISE EXCEPTION 'Included home identity changed.'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id IN('68ad7bb6-458f-4c0c-921f-3299251ac3fa','830332a2-3cee-4967-bd57-7cd625f8f9f9') AND role<>'owner')
 OR (SELECT count(*) FROM public.user_roles WHERE user_id IN('68ad7bb6-458f-4c0c-921f-3299251ac3fa','830332a2-3cee-4967-bd57-7cd625f8f9f9') AND role='owner')<>2 THEN RAISE EXCEPTION 'Both logins must have owner-only access.'; END IF;
 IF (SELECT count(*) FROM auth.users WHERE id IN('68ad7bb6-458f-4c0c-921f-3299251ac3fa','830332a2-3cee-4967-bd57-7cd625f8f9f9') AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()))<>2 THEN RAISE EXCEPTION 'Both homeowner logins must be enabled.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_programs WHERE id<>p.id AND owner_user_id IN('68ad7bb6-458f-4c0c-921f-3299251ac3fa','830332a2-3cee-4967-bd57-7cd625f8f9f9')) OR EXISTS(SELECT 1 FROM public.program_members WHERE program_id<>p.id AND user_id IN('68ad7bb6-458f-4c0c-921f-3299251ac3fa','830332a2-3cee-4967-bd57-7cd625f8f9f9') AND removed_at IS NULL) THEN RAISE EXCEPTION 'A login belongs to another program.'; END IF;
 IF (SELECT count(*) FROM public.owner_time_entries WHERE program_id=p.id)<>6 OR (SELECT sum(minutes) FROM public.owner_time_entries WHERE program_id=p.id)<>302 THEN RAISE EXCEPTION 'Participation changed before this correction.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='68ad7bb6-458f-4c0c-921f-3299251ac3fa' AND lower(email)='rlee07@gmail.com') THEN RAISE EXCEPTION 'Ryan login email changed.'; END IF;
 SELECT * INTO f FROM public.profiles WHERE id='830332a2-3cee-4967-bd57-7cd625f8f9f9' FOR UPDATE;
 IF lower(f.email)<>'lmlee26@gmail.com' THEN RAISE EXCEPTION 'Lindsey login email changed.'; END IF;
 before_profile:=jsonb_build_object('full_name',f.full_name,'first_name',f.first_name);
 IF _undo THEN
  IF p.owner_user_id IS DISTINCT FROM '68ad7bb6-458f-4c0c-921f-3299251ac3fa'::uuid THEN RAISE EXCEPTION 'The correction is not the current primary.'; END IF;
  IF EXISTS(SELECT 1 FROM public.owner_welcome_messages WHERE program_id=p.id AND owner_user_id='68ad7bb6-458f-4c0c-921f-3299251ac3fa' AND status IN('sent','sending')) THEN RAISE EXCEPTION 'Welcome delivery has started. Stop before undoing identity.'; END IF;
  DELETE FROM public.owner_welcome_messages WHERE program_id=p.id AND owner_user_id='68ad7bb6-458f-4c0c-921f-3299251ac3fa' AND status IN('queued','failed');
  DELETE FROM public.program_members WHERE program_id=p.id AND user_id='68ad7bb6-458f-4c0c-921f-3299251ac3fa' AND added_by=auth.uid();
  UPDATE public.program_members SET role='primary',added_by=NULL WHERE id='7fc511b9-b8cd-449c-a3ce-cc4456693553' AND program_id=p.id;
  UPDATE public.owner_programs SET owner_user_id='830332a2-3cee-4967-bd57-7cd625f8f9f9' WHERE id=p.id;
  UPDATE public.profiles SET full_name='Ryan Lee',first_name=NULL WHERE id=f.id;
  UPDATE public.team_invites SET revoked_at=NULL WHERE id IN('a681d7bf-b43f-4e4b-8057-0bf70cd22bd5','eb1fca9a-91a9-4b16-8b62-6948fb26755f') AND redeemed_at IS NULL;
  INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,detail) VALUES(p.id,'program_updated','Lee homeowner correction reversed; original identity restored.',auth.uid(),jsonb_build_object('correction','lee-swap','undo',true));
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value) VALUES(auth.uid(),'owner_program.lee_swap_undo','owner_program',p.id,'Approved correction rollback',jsonb_build_object('primary',p.owner_user_id),jsonb_build_object('primary','830332a2-3cee-4967-bd57-7cd625f8f9f9'));
  RETURN jsonb_build_object('undone',true);
 END IF;
 IF p.owner_user_id IS DISTINCT FROM '830332a2-3cee-4967-bd57-7cd625f8f9f9'::uuid OR f.full_name IS DISTINCT FROM 'Ryan Lee' OR f.first_name IS NOT NULL THEN RAISE EXCEPTION 'Original primary identity changed.'; END IF;
 IF EXISTS(SELECT 1 FROM public.program_members WHERE user_id='68ad7bb6-458f-4c0c-921f-3299251ac3fa') OR (SELECT count(*) FROM public.program_members WHERE program_id=p.id AND removed_at IS NULL)<>1 THEN RAISE EXCEPTION 'Membership changed. Review before correcting.'; END IF;
 PERFORM 1 FROM public.program_members WHERE id='7fc511b9-b8cd-449c-a3ce-cc4456693553' AND program_id=p.id AND user_id=f.id AND role='primary' AND removed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original primary membership changed.'; END IF;
 PERFORM 1 FROM public.team_invites WHERE id IN('a681d7bf-b43f-4e4b-8057-0bf70cd22bd5','eb1fca9a-91a9-4b16-8b62-6948fb26755f') AND redeemed_at IS NULL AND revoked_at IS NULL FOR UPDATE;
 IF (SELECT count(*) FROM public.team_invites WHERE id IN('a681d7bf-b43f-4e4b-8057-0bf70cd22bd5','eb1fca9a-91a9-4b16-8b62-6948fb26755f') AND redeemed_at IS NULL AND revoked_at IS NULL)<>2 THEN RAISE EXCEPTION 'An invitation changed.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_welcome_messages WHERE program_id=p.id) THEN RAISE EXCEPTION 'A welcome already exists. Review before correcting.'; END IF;
 UPDATE public.program_members SET role='co_owner',added_by=auth.uid() WHERE id='7fc511b9-b8cd-449c-a3ce-cc4456693553';
 INSERT INTO public.program_members(program_id,user_id,role,added_by) VALUES(p.id,'68ad7bb6-458f-4c0c-921f-3299251ac3fa','primary',auth.uid()) RETURNING id INTO membership;
 UPDATE public.owner_programs SET owner_user_id='68ad7bb6-458f-4c0c-921f-3299251ac3fa' WHERE id=p.id;
 -- Program contact fields describe the canonical owner group, not the login. Keep them and the property owner unchanged.
 UPDATE public.profiles SET full_name='Lindsey Lee',first_name='Lindsey' WHERE id=f.id;
 INSERT INTO public.owner_welcome_messages(program_id,owner_user_id,property_id,recipient,status,queued_by,is_demo) VALUES(p.id,'68ad7bb6-458f-4c0c-921f-3299251ac3fa',p.property_id,'rlee07@gmail.com','queued',auth.uid(),false) RETURNING id INTO w;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,previous_value,new_value,detail) VALUES(p.id,'program_updated',summary_text,auth.uid(),p.owner_user_id::text,'68ad7bb6-458f-4c0c-921f-3299251ac3fa',jsonb_build_object('correction','lee-swap','memberId',membership,'welcomeId',w,'oldProfile',before_profile,'historyRetained',true));
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,reason,before_value,after_value) VALUES(auth.uid(),'owner_program.lee_swap','owner_program',p.id,summary_text,'Emily approved Ryan as main homeowner and Lindsey as co-owner.',jsonb_build_object('primary',p.owner_user_id,'profile',before_profile),jsonb_build_object('primary','68ad7bb6-458f-4c0c-921f-3299251ac3fa','coOwner',f.id,'welcomeId',w));
 FOR inv IN SELECT * FROM public.team_invites WHERE id IN('a681d7bf-b43f-4e4b-8057-0bf70cd22bd5','eb1fca9a-91a9-4b16-8b62-6948fb26755f') LOOP
  UPDATE public.team_invites SET revoked_at=now() WHERE id=inv.id AND redeemed_at IS NULL;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value) VALUES(auth.uid(),'team_invite.revoked','team_invite',inv.id,'Unused invitation superseded by the approved Lee homeowner correction.',jsonb_build_object('revoked_at',inv.revoked_at),jsonb_build_object('revoked_at',now()));
 END LOOP;
 RETURN jsonb_build_object('programId',p.id,'primaryId','68ad7bb6-458f-4c0c-921f-3299251ac3fa','coOwnerId',f.id,'welcomeId',w,'memberId',membership);
END $function$;
REVOKE ALL ON FUNCTION public.apply_lee_homeowner_correction(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_lee_homeowner_correction(boolean) TO authenticated,service_role;