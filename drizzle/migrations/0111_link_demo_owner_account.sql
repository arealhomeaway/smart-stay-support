CREATE OR REPLACE FUNCTION public.link_demo_owner_account(_program_id uuid, _user_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prog public.owner_programs; acct auth.users;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Only an administrator can link a demo homeowner account.'; END IF;
 IF length(trim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'A reason is required.'; END IF;
 SELECT * INTO prog FROM public.owner_programs WHERE id=_program_id FOR UPDATE;
 IF NOT FOUND OR prog.is_demo IS NOT TRUE OR prog.archived_at IS NOT NULL THEN
  RAISE EXCEPTION 'Only an active demo homeowner program can be linked this way.'; END IF;
 IF EXISTS (SELECT 1 FROM public.owner_program_properties pp LEFT JOIN public.properties h ON h.id=pp.property_id
   WHERE pp.program_id=prog.id AND (pp.is_demo IS NOT TRUE OR h.is_demo IS NOT TRUE)) THEN
  RAISE EXCEPTION 'Every home in this program must be a demo home.'; END IF;
 IF prog.owner_user_id IS NOT NULL AND prog.owner_user_id<>_user_id THEN
  RAISE EXCEPTION 'This demo program is already linked to another account.'; END IF;
 SELECT * INTO acct FROM auth.users WHERE id=_user_id;
 IF NOT FOUND OR acct.email_confirmed_at IS NULL OR lower(acct.email) NOT LIKE '%@resolve-test.invalid' THEN
  RAISE EXCEPTION 'Only a dedicated synthetic test account can be linked.'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text<>'owner')
  OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='owner') THEN
  RAISE EXCEPTION 'The test account must hold only the homeowner role.'; END IF;
 IF EXISTS (SELECT 1 FROM public.owner_programs WHERE owner_user_id=_user_id AND id<>prog.id) THEN
  RAISE EXCEPTION 'This test account is already linked to another program.'; END IF;
 UPDATE public.owner_programs SET owner_user_id=_user_id WHERE id=prog.id;
 INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
 VALUES (auth.uid(),'owner_program.demo_account_linked','owner_program',prog.id,acct.email,_reason,
  jsonb_build_object('owner_user_id',prog.owner_user_id), jsonb_build_object('owner_user_id',_user_id,'is_demo',true));
 RETURN prog.id;
END $$;
REVOKE ALL ON FUNCTION public.link_demo_owner_account(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_demo_owner_account(uuid,uuid,text) TO authenticated;