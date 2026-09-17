-- Unapplied. A receipt retains the explicit invite/program/Owner/account binding;
-- recipient email verifies this invitation and never selects a canonical Owner.
CREATE TABLE public.owner_invite_redemptions (
 invite_id uuid PRIMARY KEY REFERENCES public.owner_invites(id),
 program_id uuid NOT NULL REFERENCES public.owner_programs(id),
 owner_record_id uuid NOT NULL REFERENCES public.property_owners(id),
 user_id uuid NOT NULL,
 recipient_email text NOT NULL,
 email_verified_at timestamptz NOT NULL,
 property_ids uuid[] NOT NULL,
 program_version uuid NOT NULL,
 redeemed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_invite_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_invite_redemptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.owner_invite_redemptions TO service_role,authenticated;
CREATE POLICY "Staff read owner invitation receipts" ON public.owner_invite_redemptions FOR SELECT TO authenticated
 USING(public.is_internal_staff(auth.uid()));

CREATE FUNCTION public.redeem_owner_invite(_user_id uuid,_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE account auth.users; invite public.owner_invites; program public.owner_programs;
 enrollment public.owner_program_properties; home public.properties; receipt public.owner_invite_redemptions;
 code_program uuid; email text; included uuid[]:='{}'::uuid[]; clock_now timestamptz:=clock_timestamp();
BEGIN
 -- Only the authenticated server handler's service client may name the actor.
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Owner invitation redemption requires the authenticated server action.';
 END IF;
 IF _user_id IS NULL OR length(trim(coalesce(_code,''))) NOT BETWEEN 4 AND 20 THEN
  RAISE EXCEPTION 'That code was not recognized. Check it and try again.';
 END IF;
 SELECT * INTO account FROM auth.users WHERE id=_user_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR account.email_confirmed_at IS NULL OR nullif(trim(account.email),'') IS NULL
  OR account.deleted_at IS NOT NULL OR account.banned_until>clock_now THEN
  RAISE EXCEPTION 'Sign in with an active account and confirm its email before redeeming an owner invitation.';
 END IF;
 email:=lower(trim(account.email));
 -- Account first serializes two different codes redeemed by one account.
 -- Program then invite matches program-dependent writes and avoids stale linking.
 SELECT program_id INTO code_program FROM public.owner_invites WHERE code=upper(trim(_code));
 IF NOT FOUND THEN RAISE EXCEPTION 'That code was not recognized. Check it and try again.'; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=code_program FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'This invitation no longer has an available program. Contact ARHA.'; END IF;
 SELECT * INTO invite FROM public.owner_invites WHERE code=upper(trim(_code)) FOR UPDATE NOWAIT;
 IF NOT FOUND OR invite.program_id IS DISTINCT FROM program.id THEN
  RAISE EXCEPTION 'This invitation changed. Refresh and try again.';
 END IF;
 IF nullif(trim(invite.owner_email),'') IS NULL THEN
  RAISE EXCEPTION 'This invitation needs an explicit recipient. Ask ARHA to issue a new code.';
 END IF;
 IF lower(trim(invite.owner_email)) IS DISTINCT FROM email THEN
  RAISE EXCEPTION 'That code was issued to a different email address.';
 END IF;
 IF program.is_demo IS DISTINCT FROM false OR program.archived_at IS NOT NULL
  OR program.status IS NULL OR program.status NOT IN ('draft','pending','waiting_for_closing','ready_for_onboarding','active','target_reached','paused') THEN
  RAISE EXCEPTION 'This program is not available for owner account enrollment.';
 END IF;
 IF program.owner_user_id IS NOT NULL AND program.owner_user_id IS DISTINCT FROM _user_id THEN
  RAISE EXCEPTION 'This program is already linked to another owner account.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'ARHA must confirm the active canonical Owner before account enrollment.'; END IF;
 -- The current portal has one program per login. Never silently change its
 -- canonical Owner or link a second program the portal cannot disambiguate.
 PERFORM 1 FROM public.owner_programs WHERE owner_user_id=_user_id AND id<>program.id FOR SHARE NOWAIT;
 IF FOUND THEN RAISE EXCEPTION 'This account is already linked to another program. Contact ARHA to review access.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=_user_id FOR UPDATE NOWAIT;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text<>'owner') THEN
  RAISE EXCEPTION 'This account has another access role. Ask an administrator to review its access before owner enrollment.';
 END IF;
 FOR enrollment IN SELECT * FROM public.owner_program_properties WHERE program_id=program.id AND inclusion_status='included'
  ORDER BY property_id FOR SHARE NOWAIT LOOP
  IF enrollment.archived_at IS NOT NULL OR enrollment.is_demo IS DISTINCT FROM false OR NOT coalesce(enrollment.closing_confirmed,false)
   OR enrollment.closing_date IS NULL OR NOT isfinite(enrollment.closing_date) OR enrollment.closing_date>current_date THEN
   RAISE EXCEPTION 'ARHA must confirm the current enrolled properties and closing dates before account enrollment.';
  END IF;
  SELECT * INTO home FROM public.properties WHERE id=enrollment.property_id FOR SHARE NOWAIT;
  IF NOT FOUND OR home.archived_at IS NOT NULL OR home.is_demo IS DISTINCT FROM false OR home.owner_record_id IS DISTINCT FROM program.owner_record_id THEN
   RAISE EXCEPTION 'Every enrolled Property must belong to the program canonical Owner and be current.';
  END IF;
  included:=array_append(included,home.id);
 END LOOP;
 IF cardinality(included)=0 THEN RAISE EXCEPTION 'ARHA must include a current Property before account enrollment.'; END IF;
 SELECT * INTO receipt FROM public.owner_invite_redemptions WHERE invite_id=invite.id;
 IF invite.redeemed_by IS NOT NULL OR invite.redeemed_at IS NOT NULL OR FOUND THEN
  IF invite.redeemed_by=_user_id AND invite.redeemed_at IS NOT NULL AND receipt.user_id=_user_id
   AND receipt.program_id=program.id AND receipt.owner_record_id=program.owner_record_id
   AND receipt.redeemed_at=invite.redeemed_at AND program.owner_user_id=_user_id
   AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text='owner')
   AND EXISTS(SELECT 1 FROM public.owner_program_events WHERE program_id=program.id AND actor_id=_user_id AND kind='owner_linked'
    AND detail->>'inviteId'=invite.id::text AND detail->>'source'='atomic_invite_redemption') THEN
   RETURN program.id;
  END IF;
  RAISE EXCEPTION 'That code was already used or its account linkage needs ARHA review.';
 END IF;
 clock_now:=clock_timestamp();
 IF invite.expires_at IS NULL OR NOT isfinite(invite.expires_at) OR invite.expires_at<=clock_now THEN
  RAISE EXCEPTION 'That code has expired. Ask your ARHA contact for a new one.';
 END IF;
 UPDATE public.owner_programs SET owner_user_id=_user_id WHERE id=program.id;
 INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,'owner') ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.owner_invites SET redeemed_by=_user_id,redeemed_at=clock_now WHERE id=invite.id;
 INSERT INTO public.owner_invite_redemptions(invite_id,program_id,owner_record_id,user_id,recipient_email,email_verified_at,property_ids,program_version,redeemed_at)
 VALUES(invite.id,program.id,program.owner_record_id,_user_id,email,account.email_confirmed_at,included,program.report_version,clock_now);
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,detail)
 VALUES(program.id,'owner_linked','Homeowner connected their account with an invite code.',_user_id,
  jsonb_build_object('source','atomic_invite_redemption','inviteId',invite.id,'ownerId',program.owner_record_id,'propertyIds',to_jsonb(included)));
 RETURN program.id;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This account, invitation, or program is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.redeem_owner_invite(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_owner_invite(uuid,text) TO service_role;

-- Supervisors may manage programs, but direct table writes cannot enroll or
-- transfer a login. Trusted service maintenance and authorized demo seed
-- functions retain their explicit privileges; ordinary inserts start unlinked.
CREATE FUNCTION public.guard_owner_account_link() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.owner_user_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN RETURN NEW; END IF;
 IF current_user<>'service_role' AND current_user IS DISTINCT FROM (
  SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.redeem_owner_invite(uuid,text)'::regprocedure
 ) THEN RAISE EXCEPTION 'Link the owner account through the atomic invitation action.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_owner_account_link() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_owner_account_link BEFORE INSERT OR UPDATE OF owner_user_id ON public.owner_programs
 FOR EACH ROW EXECUTE FUNCTION public.guard_owner_account_link();

CREATE FUNCTION public.preserve_owner_invite_redemption() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='owner_invite_redemptions' THEN
  IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Owner invitation redemption receipts are immutable.'; END IF;
  IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.redeem_owner_invite(uuid,text)'::regprocedure) THEN
   RAISE EXCEPTION 'Record owner invitation redemption through the atomic action.';
  END IF;
 ELSIF TG_TABLE_NAME='owner_invites' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.redeemed_by IS NULL AND NEW.redeemed_at IS NULL THEN RETURN NEW; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.owner_invite_redemptions WHERE invite_id=OLD.id) THEN
    RAISE EXCEPTION 'A redeemed owner invitation is immutable.';
   END IF;
   IF TG_OP='DELETE' THEN RETURN OLD; END IF;
   IF NEW.redeemed_by IS NOT DISTINCT FROM OLD.redeemed_by AND NEW.redeemed_at IS NOT DISTINCT FROM OLD.redeemed_at THEN RETURN NEW; END IF;
  END IF;
  IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.redeem_owner_invite(uuid,text)'::regprocedure) THEN
   RAISE EXCEPTION 'Redeem the owner invitation through the atomic action.';
  END IF;
 ELSE
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.detail->>'source'='atomic_invite_redemption' THEN
   RAISE EXCEPTION 'Owner invitation linkage history is immutable.';
  END IF;
  IF TG_OP<>'DELETE' AND NEW.detail->>'source'='atomic_invite_redemption' AND current_user IS DISTINCT FROM (
   SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.redeem_owner_invite(uuid,text)'::regprocedure
  ) THEN RAISE EXCEPTION 'Record owner linkage history through the atomic action.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preserve_owner_invite_redemption() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_owner_invite_redemption BEFORE INSERT OR UPDATE OR DELETE ON public.owner_invite_redemptions
 FOR EACH ROW EXECUTE FUNCTION public.preserve_owner_invite_redemption();
CREATE TRIGGER preserve_owner_invite_claim BEFORE INSERT OR UPDATE OR DELETE ON public.owner_invites
 FOR EACH ROW EXECUTE FUNCTION public.preserve_owner_invite_redemption();
CREATE TRIGGER preserve_owner_invite_history BEFORE INSERT OR UPDATE OR DELETE ON public.owner_program_events
 FOR EACH ROW EXECUTE FUNCTION public.preserve_owner_invite_redemption();
