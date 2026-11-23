-- ao-auto-enroll (staged Nov 23). Apply only on the exact words: Approved: apply ao-auto-enroll
-- One transaction, additive. Lets the existing one-step enrollment run for whoever set a home to
-- Active Owner (and for the 5 minute check), on the server only, recorded as that person.
-- Undo: apply.undo.sql (restores both functions byte for byte from original_*.sql).

-- 1. The Onboarding Director check is also true for exactly one person, only inside the server-only
--    automatic setup below (a transaction-local setting no app request can set).
CREATE OR REPLACE FUNCTION public.is_onboarding_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles
    WHERE code IN ('onboarding_director','director_onboarding') AND current_seat_holder = _user_id)
  OR coalesce(_user_id IS NOT NULL AND _user_id::text = nullif(current_setting('resolve.ao_auto_enroll_actor', true), ''), false)
$function$;

-- 2. The existing enrollment step. Unchanged for every current caller. Inside automatic setup only:
--    no email means no login and no welcome yet (the program still goes live); no closing date stops
--    before the closing step (activation needs a closing date, unchanged).
CREATE OR REPLACE FUNCTION public.active_owner_enrollment_step(_request_id uuid, _step text, _input jsonb, _account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE auto boolean; has_email boolean; no_login boolean; opened int; prior int; run public.active_owner_enrollment_runs; home public.properties; owner public.property_owners;
 p public.owner_programs; date_value date; receipt jsonb; seeded jsonb; previous jsonb; phase_value text; template public.owner_task_templates;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only the Onboarding Director or an Admin can enroll.';
 END IF;
 -- ao-auto-enroll: only the server-only wrapper sets this flag, for its own actor, inside its own transaction.
 auto:=coalesce(auth.uid() IS NOT NULL AND nullif(current_setting('resolve.ao_auto_enroll_actor',true),'')=auth.uid()::text, false);
 has_email:=length(trim(coalesce(_input->>'email','')))>0;
 no_login:=auto AND NOT has_email;
 IF _request_id IS NULL OR _input IS NULL OR jsonb_typeof(_input)<>'object'
 OR length(trim(coalesce(_input->>'name',''))) NOT BETWEEN 2 AND 120
 OR (NOT no_login AND (length(coalesce(_input->>'email','')) NOT BETWEEN 3 AND 255
 OR (_input->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
 OR length(coalesce(_input->>'reason',''))>1000 OR length(coalesce(_input->>'notes',''))>4000 THEN
   RAISE EXCEPTION 'Check homeowner details and closing date before enrolling.';
 END IF;
 date_value:=CASE WHEN auto THEN nullif(_input->>'closingDate','')::date ELSE (_input->>'closingDate')::date END;
 IF (date_value IS NULL AND NOT auto) OR (date_value IS NOT NULL AND NOT isfinite(date_value)) THEN RAISE EXCEPTION 'A closing date is required.'; END IF;
 SELECT * INTO home FROM properties WHERE id=(_input->>'propertyId')::uuid FOR UPDATE;
 IF NOT FOUND OR home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM (_input->>'ownerRecordId')::uuid THEN
  RAISE EXCEPTION 'The home changed its Owner. Refresh before enrolling.';
 END IF;
 IF private.is_synthetic_account() AND NOT home.is_demo THEN RAISE EXCEPTION 'Test accounts can only enroll practice homes.'; END IF;
 SELECT * INTO owner FROM property_owners WHERE id=home.owner_record_id AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'An active homeowner record is required.'; END IF;
 IF home.actual_closing_on IS NOT NULL AND home.actual_closing_on<>date_value AND length(trim(coalesce(_input->>'reason','')))<5 THEN
  RAISE EXCEPTION 'Give the reason for changing the confirmed date.';
 END IF;
 IF (SELECT count(*) FROM owner_programs WHERE owner_record_id=owner.id AND is_demo=home.is_demo AND archived_at IS NULL AND status NOT IN ('closed','completed','complete'))>1 THEN
  RAISE EXCEPTION 'Resolve conflicting homeowner programs before enrolling.';
 END IF;
 IF EXISTS(SELECT 1 FROM profiles f JOIN user_roles r ON r.user_id=f.id WHERE lower(f.email)=lower(_input->>'email') AND r.role<>'owner') THEN
  RAISE EXCEPTION 'That email belongs to a staff account. Use the homeowner''s own email.';
 END IF;
 IF EXISTS(SELECT 1 FROM owner_programs existing_program JOIN profiles f ON f.id=existing_program.owner_user_id
 WHERE existing_program.owner_record_id=owner.id AND existing_program.archived_at IS NULL AND existing_program.status NOT IN ('closed','completed','complete')
 AND lower(f.email)<>lower(_input->>'email')) THEN
  RAISE EXCEPTION 'This Owner has a different linked login. An Admin must review account identity first.';
 END IF;
 -- Serializes same-home and same-owner saves; durable checkpoint survives network interruptions.
 INSERT INTO active_owner_enrollment_runs(id,actor_id,property_id,input) VALUES(_request_id,auth.uid(),home.id,_input) ON CONFLICT DO NOTHING;
 SELECT * INTO run FROM active_owner_enrollment_runs WHERE id=_request_id FOR UPDATE;
 IF run.actor_id<>auth.uid() OR run.input IS DISTINCT FROM _input THEN RAISE EXCEPTION 'Retry with the original enrollment details.'; END IF;
 IF _step='prepare' THEN RETURN jsonb_build_object('programId',run.program_id); END IF;
 IF _step NOT IN ('account','enrollment','closing','activation','onboarding','operating','welcome') THEN RAISE EXCEPTION 'Unknown enrollment step.'; END IF;
 IF run.checkpoints ? _step THEN RETURN run.checkpoints->_step; END IF;
 IF _step<>'account' AND NOT (run.checkpoints ? (CASE _step WHEN 'enrollment' THEN 'account' WHEN 'closing' THEN 'enrollment'
   WHEN 'activation' THEN 'closing' WHEN 'onboarding' THEN 'activation' WHEN 'operating' THEN 'onboarding' ELSE 'operating' END)) THEN
  RAISE EXCEPTION 'Finish the preceding enrollment step before continuing.';
 END IF;
 IF _step='account' AND no_login THEN
  -- No homeowner email yet: no login now; the program still goes live. A later run with the email adds the login and welcome.
  IF _account_id IS NOT NULL THEN RAISE EXCEPTION 'The login does not match this email.'; END IF;
  receipt:=jsonb_build_object('programId',run.program_id,'skipped','no_email');
 ELSIF _step='account' THEN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=_account_id AND lower(email)=lower(_input->>'email')) THEN RAISE EXCEPTION 'The login does not match this email.'; END IF;
  PERFORM 1 FROM auth.users WHERE id=_account_id AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An enabled homeowner login is required.'; END IF;
   IF EXISTS(SELECT 1 FROM user_roles WHERE user_id=_account_id AND role<>'owner') THEN RAISE EXCEPTION 'Staff logins cannot be used for homeowners.'; END IF;
  INSERT INTO user_roles(user_id,role) VALUES(_account_id,'owner') ON CONFLICT(user_id,role) DO NOTHING;
  INSERT INTO audit_log(actor_id,action,entity_type,entity_id,after_value)
   VALUES(auth.uid(),'owner.enrollment_login','user',_account_id,jsonb_build_object('requestId',run.id,'propertyId',home.id,'role','owner'));
  UPDATE active_owner_enrollment_runs SET account_id=_account_id WHERE id=run.id;
  receipt:=jsonb_build_object('programId',run.program_id);
 ELSE
  IF (no_login AND (run.account_id IS NOT NULL OR _account_id IS NOT NULL))
   OR (NOT no_login AND (run.account_id IS NULL OR run.account_id IS DISTINCT FROM _account_id)) THEN RAISE EXCEPTION 'Check the homeowner login first.'; END IF;
  IF _step='enrollment' THEN
   IF NOT no_login AND (NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_account_id AND role='owner')
    OR EXISTS(SELECT 1 FROM user_roles WHERE user_id=_account_id AND role<>'owner')) THEN RAISE EXCEPTION 'An owner-only login is required.'; END IF;
   -- Existing enrollment/link action, not a separate program creator. Prevent early queue until final step.
   receipt:=public.create_owner_program(home.id);
   SELECT * INTO p FROM owner_programs WHERE id=(receipt->>'programId')::uuid FOR UPDATE;
   IF no_login THEN
    NULL;
   ELSIF home.is_demo THEN
    IF NOT private.demo_owner_link_ok(_account_id,p.id) THEN RAISE EXCEPTION 'Link this practice account through the existing demo owner action first.'; END IF;
   ELSE
    PERFORM public.staff_link_owner_account(p.id, _account_id);
   END IF;
   UPDATE active_owner_enrollment_runs SET program_id=p.id WHERE id=run.id;
    UPDATE property_owners SET name=trim(_input->>'name'),email=CASE WHEN no_login THEN email ELSE lower(trim(_input->>'email')) END WHERE id=owner.id;
   INSERT INTO owner_program_events(program_id,kind,summary,actor_id,detail) VALUES(p.id,'owner_enrollment_details','Homeowner enrollment details saved.',auth.uid(),jsonb_build_object('requestId',run.id,'previousName',owner.name,'previousEmail',owner.email));
  ELSE
   SELECT * INTO p FROM owner_programs WHERE id=run.program_id FOR UPDATE;
   IF NOT FOUND OR p.owner_record_id<>owner.id OR (NOT no_login AND p.owner_user_id<>_account_id) OR (no_login AND p.owner_user_id IS NOT NULL) THEN RAISE EXCEPTION 'Program identity changed. Review before retrying.'; END IF;
   IF p.status IN ('paused','closed','completed','complete') THEN RAISE EXCEPTION 'Paused or closed participation cannot be restarted through enrollment.'; END IF;
   IF _step='closing' THEN
    IF date_value IS NULL THEN RAISE EXCEPTION 'A closing date is required.'; END IF;
    IF home.actual_closing_on IS NOT NULL THEN
     IF home.actual_closing_on<>date_value THEN PERFORM public.correct_actual_closing(home.id,date_value,_input->>'reason'); END IF;
    ELSE
      UPDATE properties SET planned_closing_on=date_value WHERE id=home.id;
    END IF;
    previous:=(SELECT to_jsonb(e) FROM owner_program_properties e WHERE program_id=p.id AND property_id=home.id);
    UPDATE owner_program_properties SET closing_date=date_value,closing_confirmed=(home.actual_closing_on IS NOT NULL) WHERE program_id=p.id AND property_id=home.id;
    INSERT INTO owner_program_events(program_id,kind,summary,actor_id,detail) VALUES(p.id,'enrollment_closing_saved','Expected or confirmed closing date recorded during enrollment.',auth.uid(),jsonb_build_object('propertyId',home.id,'previous',previous,'date',date_value,'reason',_input->>'reason','requestId',run.id));
    INSERT INTO audit_log(actor_id,action,entity_type,entity_id,before_value,after_value) VALUES(auth.uid(),'owner.enrollment_closing','property',home.id,to_jsonb(home),jsonb_build_object('date',date_value,'confirmed',home.actual_closing_on IS NOT NULL,'requestId',run.id));
    SELECT * INTO p FROM owner_programs WHERE id=run.program_id FOR UPDATE;
    seeded:=public.change_owner_program(p.id,p.report_version,'settings',_settings=>jsonb_build_object('onboardingLead',_input->'onboardingLead','operationsLead',_input->'operationsLead','dfyConfirmed',coalesce(p.dfy_confirmed,false),'internalNotes',_input->>'notes'));
   ELSIF _step='activation' THEN
    IF p.status NOT IN ('active','target_reached') THEN PERFORM public.activate_owner_program(p.id,p.report_version,NULL); END IF;
    ELSIF _step IN ('onboarding','operating') THEN
    phase_value:=CASE WHEN _step='onboarding' THEN 'onboarding' ELSE 'ongoing' END;
    seeded:=public.change_owner_program(p.id,p.report_version,'seed_roadmap',_phase=>phase_value);
    -- Existing release creates prepared participation Opportunities. Open only these templates; Finance/internal Tasks unchanged.
    -- Batch release (0160): per-Opportunity alerts suppressed; one summary for the whole enrollment after the operating step.
    PERFORM public.owner_release_batch_begin();
    UPDATE owner_reviews SET status='awaiting_owner' WHERE program_id=p.id AND status='prepared' AND phase=phase_value AND template_id IS NOT NULL
     AND (phase_value='ongoing' OR property_id=home.id);
    GET DIAGNOSTICS opened = ROW_COUNT;
    IF _step='operating' THEN
      prior:=coalesce((run.checkpoints->'onboarding'->>'opened')::int,0);
     PERFORM public.owner_release_summary(p.id, prior+opened, ARRAY[home.id]);
    ELSE
     PERFORM set_config('resolve.owner_release_batch','off',true);
    END IF;
    receipt:=jsonb_build_object('programId',p.id,'added',coalesce((seeded->>'added')::int,0),'opened',opened);
   ELSIF _step='welcome' AND no_login THEN
    RAISE EXCEPTION 'Add the homeowner''s email first.';
   ELSIF _step='welcome' THEN
    PERFORM public.enroll_active_owner(home.id,_account_id);
    receipt:=jsonb_build_object('programId',p.id,'held',coalesce((SELECT value->>'review' FROM app_settings WHERE key='owner_welcome_template'),'draft')<>'approved');
   END IF;
   END IF;
 END IF;
 receipt:=coalesce(receipt,jsonb_build_object('programId',coalesce(p.id,run.program_id)));
 UPDATE active_owner_enrollment_runs SET checkpoints=checkpoints||jsonb_build_object(_step,receipt),updated_at=now() WHERE id=run.id;
 RETURN receipt;
END $function$;

-- 3. Server-only wrapper: runs one enrollment step as the given staff member.
CREATE OR REPLACE FUNCTION public.active_owner_auto_enrollment_step(_actor_id uuid, _request_id uuid, _step text, _input jsonb, _account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prior_claims text:=current_setting('request.jwt.claims',true); prior_sub text:=current_setting('request.jwt.claim.sub',true); result jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Automatic Active Owner setup runs only on the server.'; END IF;
 IF _actor_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_actor_id AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()))
  OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id)
  OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text IN ('owner','vendor')) THEN
  RAISE EXCEPTION 'Automatic Active Owner setup needs an enabled staff account.';
 END IF;
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',_actor_id::text,'role','authenticated')::text, true);
 PERFORM set_config('request.jwt.claim.sub', _actor_id::text, true);
 PERFORM set_config('resolve.ao_auto_enroll_actor', _actor_id::text, true);
 result:=public.active_owner_enrollment_step(_request_id,_step,_input,_account_id);
 PERFORM set_config('resolve.ao_auto_enroll_actor', '', true);
 PERFORM set_config('request.jwt.claims', coalesce(prior_claims,''), true);
 PERFORM set_config('request.jwt.claim.sub', coalesce(prior_sub,''), true);
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.active_owner_auto_enrollment_step(uuid,uuid,text,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.active_owner_auto_enrollment_step(uuid,uuid,text,jsonb,uuid) TO service_role;

-- 4. Needs you now items for Active Owner setup (missing email, missing closing date, other problems).
--    Written only by the server; staff read their own, Admin reads all, the Director reads the shared ones.
CREATE TABLE public.active_owner_setup_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  kind text NOT NULL CHECK (kind IN ('add_email','add_closing','needs_attention')),
  audience text NOT NULL CHECK (audience IN ('person','director_and_admin')),
  assigned_to uuid,
  route_reason text,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 300),
  detail text CHECK (detail IS NULL OR length(detail) <= 1000),
  link_path text NOT NULL CHECK (link_path LIKE '/%'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  source text NOT NULL,
  actor_id uuid,
  request_id uuid,
  request_input jsonb,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz,
  close_reason text,
  closed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='open' AND closed_at IS NULL) OR (status='closed' AND closed_at IS NOT NULL)),
  CHECK (audience='director_and_admin' OR assigned_to IS NOT NULL)
);
CREATE UNIQUE INDEX active_owner_setup_items_one_open ON public.active_owner_setup_items(property_id, kind) WHERE status='open';
CREATE INDEX active_owner_setup_items_assignee_open ON public.active_owner_setup_items(assigned_to) WHERE status='open';
GRANT SELECT ON public.active_owner_setup_items TO authenticated;
GRANT ALL ON public.active_owner_setup_items TO service_role;
ALTER TABLE public.active_owner_setup_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY active_owner_setup_items_read ON public.active_owner_setup_items FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR (audience='director_and_admin' AND public.is_onboarding_director(auth.uid())));

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_auto_enroll.apply', 'function', 'automatic Active Owner enrollment',
  'Any path that sets a home to Active Owner enrolls it fully through the existing enrollment step, on the server, as the person who saved; the 5 minute check is the safety net. Undo: docs/pending/ao-auto-enroll/apply.undo.sql.',
  jsonb_build_object('changes', jsonb_build_array('is_onboarding_director', 'active_owner_enrollment_step'), 'adds', jsonb_build_array('active_owner_auto_enrollment_step', 'active_owner_setup_items')));
