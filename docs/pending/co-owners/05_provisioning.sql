-- PENDING ONLY. Pass 3B co-owner provisioning. Requires 01, 03 and 04 applied first.
-- Replaces exactly one live function (private.demo_owner_link_ok, ACL kept by CREATE OR REPLACE):
-- a co-owner added by an Admin passes the practice-home check; every other condition is identical.
CREATE OR REPLACE FUNCTION private.demo_owner_link_ok(_actor uuid, _program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT _actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.owner_programs p JOIN auth.users a ON a.id=_actor
  WHERE p.id=_program_id AND p.is_demo AND p.archived_at IS NULL AND private.is_program_member(p.id,_actor)
   AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
   AND a.email_confirmed_at IS NOT NULL AND lower(a.email) LIKE '%@resolve-test.invalid'
   AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text='owner')
   AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text<>'owner')
   AND NOT EXISTS(SELECT 1 FROM public.owner_programs o WHERE o.owner_user_id=_actor AND o.id<>p.id)
   AND EXISTS(SELECT 1 FROM public.owner_program_properties pp WHERE pp.program_id=p.id)
   AND NOT EXISTS(SELECT 1 FROM public.owner_program_properties pp LEFT JOIN public.properties h ON h.id=pp.property_id
     WHERE pp.program_id=p.id AND (pp.is_demo IS NOT TRUE OR h.is_demo IS NOT TRUE))
   AND (SELECT l.action='owner_program.demo_account_linked' AND l.after_value->>'owner_user_id'=_actor::text
        FROM public.audit_log l WHERE l.entity_type='owner_program' AND l.entity_id=p.id
         AND l.action IN ('owner_program.demo_account_linked','owner_program.demo_account_unlinked')
         AND public.has_role(l.actor_id,'admin')
        ORDER BY l.created_at DESC LIMIT 1) IS TRUE
    OR EXISTS(SELECT 1 FROM public.program_members m WHERE m.program_id=p.id AND m.user_id=_actor
     AND m.role='co_owner' AND m.removed_at IS NULL AND public.has_role(m.added_by,'admin')))
$function$;

-- Staff add a co-owner. Two-phase only when no login exists yet: phase one validates and
-- writes nothing ({needsAccount:true}); the server then creates the owner-only login through the
-- canonical enrollment account path and calls again with _account_id. Each call is one transaction.
CREATE FUNCTION public.add_program_co_owner(_program_id uuid, _full_name text, _email text, _account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, private, pg_temp AS $function$
DECLARE program public.owner_programs; addr text; who uuid; member_id uuid; welcome_id uuid; existing_login boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only the Onboarding Director or an Admin can add a co-owner.';
 END IF;
 addr:=lower(trim(coalesce(_email,'')));
 IF length(trim(coalesce(_full_name,''))) NOT BETWEEN 2 AND 120 OR length(addr) NOT BETWEEN 3 AND 255
  OR addr !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
  RAISE EXCEPTION 'Enter the co-owner''s full name and a valid email.';
 END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE;
 IF NOT FOUND OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed','complete') THEN
  RAISE EXCEPTION 'This Active Owner program is not open for new homeowners.';
 END IF;
 IF program.owner_user_id IS NULL THEN RAISE EXCEPTION 'Finish enrolling the main homeowner before adding a co-owner.'; END IF;
 IF private.is_synthetic_account() AND NOT program.is_demo THEN RAISE EXCEPTION 'Test accounts can only change practice homes.'; END IF;
 IF program.is_demo AND (NOT public.has_role(auth.uid(),'admin') OR addr NOT LIKE '%@resolve-test.invalid') THEN
  RAISE EXCEPTION 'On a practice home, an Admin adds co-owners with a practice email only.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.profiles f JOIN public.user_roles r ON r.user_id=f.id WHERE lower(f.email)=addr AND r.role<>'owner') THEN
  RAISE EXCEPTION 'That email belongs to a staff account. Use the homeowner''s own email.';
 END IF;
 SELECT id INTO who FROM public.profiles WHERE lower(email)=addr;
 existing_login:=who IS NOT NULL AND _account_id IS NULL;
 IF _account_id IS NOT NULL THEN
  IF who IS DISTINCT FROM _account_id THEN RAISE EXCEPTION 'The login does not match this email.'; END IF;
 END IF;
 IF who IS NOT NULL AND who=program.owner_user_id THEN RAISE EXCEPTION 'This person is already the main homeowner.'; END IF;
 IF who IS NOT NULL AND EXISTS(SELECT 1 FROM public.program_members WHERE program_id=program.id AND user_id=who AND removed_at IS NULL) THEN
  RAISE EXCEPTION 'This person is already a homeowner on this program.';
 END IF;
 IF who IS NULL THEN RETURN jsonb_build_object('needsAccount',true); END IF;
 PERFORM 1 FROM auth.users WHERE id=who AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled homeowner login is required.'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=who AND role<>'owner') THEN RAISE EXCEPTION 'Staff logins cannot be used for homeowners.'; END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES(who,'owner') ON CONFLICT(user_id,role) DO NOTHING;
 INSERT INTO public.program_members(program_id,user_id,role,added_by) VALUES(program.id,who,'co_owner',auth.uid()) RETURNING id INTO member_id;
 -- The existing welcome queue; unique per (program, login), so the primary's welcome is never queued again.
 INSERT INTO public.owner_welcome_messages(program_id,owner_user_id,property_id,recipient,status,queued_by,is_demo)
 VALUES(program.id,who,program.property_id,addr,CASE WHEN program.is_demo THEN 'held_demo' ELSE 'queued' END,auth.uid(),program.is_demo)
 ON CONFLICT(program_id,owner_user_id) DO NOTHING RETURNING id INTO welcome_id;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,'co_owner_added','Co-owner added: '||trim(_full_name)||'.',auth.uid(),who::text,
  jsonb_build_object('memberId',member_id,'userId',who,'linkedExisting',existing_login,'welcomeId',welcome_id));
 IF welcome_id IS NOT NULL THEN
  INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,detail)
  VALUES(program.id,'welcome_queued','Welcome email queued for the new co-owner.',auth.uid(),
   jsonb_build_object('welcomeId',welcome_id,'userId',who,'demo',program.is_demo));
 END IF;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,after_value)
 VALUES(auth.uid(),'owner_program.co_owner_added','owner_program',program.id,
  jsonb_build_object('memberId',member_id,'userId',who,'role','co_owner','linkedExisting',existing_login));
 RETURN jsonb_build_object('memberId',member_id,'userId',who,'linkedExisting',existing_login,
  'welcomeQueued',welcome_id IS NOT NULL,'held',program.is_demo);
END $function$;
REVOKE ALL ON FUNCTION public.add_program_co_owner(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_program_co_owner(uuid,text,text,uuid) TO authenticated;

CREATE FUNCTION public.remove_program_co_owner(_program_id uuid, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, private, pg_temp AS $function$
DECLARE program public.owner_programs; member public.program_members;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only the Onboarding Director or an Admin can remove a co-owner.';
 END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This Active Owner program was not found.'; END IF;
 IF private.is_synthetic_account() AND NOT program.is_demo THEN RAISE EXCEPTION 'Test accounts can only change practice homes.'; END IF;
 IF _user_id IS NOT DISTINCT FROM program.owner_user_id THEN RAISE EXCEPTION 'The main homeowner cannot be removed here.'; END IF;
 SELECT * INTO member FROM public.program_members WHERE program_id=program.id AND user_id=_user_id AND removed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This person is not a current co-owner.'; END IF;
 IF member.role<>'co_owner' THEN RAISE EXCEPTION 'The main homeowner cannot be removed here.'; END IF;
 UPDATE public.program_members SET removed_at=now(),removed_by=auth.uid() WHERE id=member.id;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,previous_value,detail)
 VALUES(program.id,'co_owner_removed','Co-owner removed. Their hours and history stay on the program.',auth.uid(),_user_id::text,
  jsonb_build_object('memberId',member.id,'userId',_user_id));
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,before_value,after_value)
 VALUES(auth.uid(),'owner_program.co_owner_removed','owner_program',program.id,
  jsonb_build_object('memberId',member.id,'userId',_user_id,'role','co_owner'),jsonb_build_object('removedAt',now()));
 RETURN jsonb_build_object('memberId',member.id,'userId',_user_id,'removed',true);
END $function$;
REVOKE ALL ON FUNCTION public.remove_program_co_owner(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_program_co_owner(uuid,uuid) TO authenticated;

-- Staff roster for the Active Owner section: main homeowner first, then current co-owners.
CREATE FUNCTION public.read_program_homeowners(_program_id uuid)
RETURNS TABLE(user_id uuid, role text, full_name text, email text, added_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, private, pg_temp AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only the Onboarding Director or an Admin can manage homeowners.';
 END IF;
 RETURN QUERY
  SELECT p.owner_user_id,'primary'::text,f.full_name,f.email,p.created_at FROM public.owner_programs p
   LEFT JOIN public.profiles f ON f.id=p.owner_user_id WHERE p.id=_program_id AND p.owner_user_id IS NOT NULL
  UNION ALL
  SELECT m.user_id,'co_owner'::text,f.full_name,f.email,m.added_at FROM public.program_members m
   JOIN public.owner_programs p ON p.id=m.program_id
   LEFT JOIN public.profiles f ON f.id=m.user_id
   WHERE m.program_id=_program_id AND m.role='co_owner' AND m.removed_at IS NULL AND m.user_id IS DISTINCT FROM p.owner_user_id
  ORDER BY 2 DESC, 5;
END $function$;
REVOKE ALL ON FUNCTION public.read_program_homeowners(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_program_homeowners(uuid) TO authenticated;

-- Portal attribution: first names for everyone who has been a homeowner on the program
-- (removed co-owners included, so their past hours keep a name) and who answered each item.
CREATE FUNCTION public.read_program_attribution(_program_id uuid)
RETURNS TABLE(kind text, ref_id uuid, user_id uuid, display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, private, pg_temp AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT (private.is_program_member(_program_id,auth.uid())
  OR public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'This program is not available to this account.';
 END IF;
 RETURN QUERY
  WITH people AS (
   SELECT p.owner_user_id uid FROM public.owner_programs p WHERE p.id=_program_id AND p.owner_user_id IS NOT NULL
   UNION SELECT m.user_id FROM public.program_members m WHERE m.program_id=_program_id
  )
  SELECT 'member'::text, NULL::uuid, x.uid,
   coalesce(nullif(trim(f.first_name),''), nullif(split_part(trim(coalesce(f.full_name,'')),' ',1),''), 'a homeowner')
  FROM people x LEFT JOIN public.profiles f ON f.id=x.uid
  UNION ALL
  SELECT a.kind, a.ref_id, a.user_id, a.display_name FROM (
   SELECT DISTINCT ON (e.review_id) 'answer'::text kind, e.review_id ref_id, e.actor_id user_id, NULL::text display_name
   FROM public.owner_program_events e JOIN people x ON x.uid=e.actor_id
   WHERE e.program_id=_program_id AND e.review_id IS NOT NULL AND e.kind IN ('owner_decision','owner_participation_response')
   ORDER BY e.review_id, e.created_at DESC
  ) a;
END $function$;
REVOKE ALL ON FUNCTION public.read_program_attribution(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_program_attribution(uuid) TO authenticated;
