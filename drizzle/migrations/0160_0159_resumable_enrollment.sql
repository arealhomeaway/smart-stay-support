-- Run after 0157, 0158 and 0160. No live seed/data fixes here.
CREATE TABLE public.active_owner_enrollment_runs (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL, property_id uuid NOT NULL,
 input jsonb NOT NULL, account_id uuid, program_id uuid, checkpoints jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.active_owner_enrollment_runs TO authenticated;
GRANT ALL ON public.active_owner_enrollment_runs TO service_role;
ALTER TABLE public.active_owner_enrollment_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrollment_receipt_authority ON public.active_owner_enrollment_runs FOR SELECT TO authenticated
 USING(actor_id=auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())));

-- Same existing activation authority and version checks, now expected dates can anchor a real closing year.
-- No expected date is falsely marked as an actual closing.
DO $$
DECLARE source text;
BEGIN
 SELECT pg_get_functiondef('public.activate_owner_program(uuid,uuid,date)'::regprocedure) INTO source;
 IF position('coalesce(enrollment.closing_confirmed,false) AND enrollment.closing_date IS NOT NULL' IN source)=0 THEN
   RAISE EXCEPTION 'Activation baseline changed. Review before applying.';
 END IF;
 source:=replace(source,'coalesce(enrollment.closing_confirmed,false) AND enrollment.closing_date IS NOT NULL','enrollment.closing_date IS NOT NULL');
 source:=replace(source,'Confirm the actual closing date of at least one included home first.','Record the expected or actual closing date of an included home first.');
 EXECUTE source;
END $$;

-- Existing add-home action: enrollment authority can add an expected-closing home to the same Owner's active program.
DO $$
DECLARE source text;
BEGIN
 SELECT pg_get_functiondef('public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure) INTO source;
 IF position('Adding a Property after activation requires an administrator and its confirmed closing date.' IN source)=0 THEN RAISE EXCEPTION 'Add-home baseline changed.'; END IF;
 source:=replace(source,'IF program.started_on IS NOT NULL AND (NOT public.has_role(actor,''admin'') OR _closing_date IS NULL) THEN','IF program.started_on IS NOT NULL AND NOT private.is_active_owner_authority(actor) THEN');
 EXECUTE source;
END $$;

CREATE OR REPLACE FUNCTION public.active_owner_enrollment_step(_request_id uuid,_step text,_input jsonb,_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE opened int; prior int; run public.active_owner_enrollment_runs; home public.properties; owner public.property_owners;
 p public.owner_programs; date_value date; receipt jsonb; seeded jsonb; previous jsonb; phase_value text; template public.owner_task_templates;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only the Onboarding Director or an Admin can enroll.';
 END IF;
 IF _request_id IS NULL OR _input IS NULL OR jsonb_typeof(_input)<>'object'
 OR length(trim(coalesce(_input->>'name',''))) NOT BETWEEN 2 AND 120
 OR length(coalesce(_input->>'email','')) NOT BETWEEN 3 AND 255
 OR (_input->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR length(coalesce(_input->>'reason',''))>1000 OR length(coalesce(_input->>'notes',''))>4000 THEN
   RAISE EXCEPTION 'Check homeowner details and closing date before enrolling.';
 END IF;
 date_value:=(_input->>'closingDate')::date;
 IF date_value IS NULL OR NOT isfinite(date_value) THEN RAISE EXCEPTION 'A closing date is required.'; END IF;
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
 IF EXISTS(SELECT 1 FROM owner_programs p JOIN profiles f ON f.id=p.owner_user_id
 WHERE p.owner_record_id=owner.id AND p.archived_at IS NULL AND p.status NOT IN ('closed','completed','complete')
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
 IF _step='account' THEN
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
  IF run.account_id IS NULL OR run.account_id IS DISTINCT FROM _account_id THEN RAISE EXCEPTION 'Check the homeowner login first.'; END IF;
  IF _step='enrollment' THEN
   IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_account_id AND role='owner')
    OR EXISTS(SELECT 1 FROM user_roles WHERE user_id=_account_id AND role<>'owner') THEN RAISE EXCEPTION 'An owner-only login is required.'; END IF;
   -- Existing enrollment/link action, not a separate program creator. Prevent early queue until final step.
   receipt:=public.create_owner_program(home.id);
   SELECT * INTO p FROM owner_programs WHERE id=(receipt->>'programId')::uuid FOR UPDATE;
   IF home.is_demo THEN
    IF NOT private.demo_owner_link_ok(_account_id,p.id) THEN RAISE EXCEPTION 'Link this practice account through the existing demo owner action first.'; END IF;
   ELSE
    PERFORM public.staff_link_owner_account(p.id, _account_id);
   END IF;
   UPDATE active_owner_enrollment_runs SET program_id=p.id WHERE id=run.id;
    UPDATE property_owners SET name=trim(_input->>'name'),email=lower(trim(_input->>'email')) WHERE id=owner.id;
   INSERT INTO owner_program_events(program_id,kind,summary,actor_id,detail) VALUES(p.id,'owner_enrollment_details','Homeowner enrollment details saved.',auth.uid(),jsonb_build_object('requestId',run.id,'previousName',owner.name,'previousEmail',owner.email));
  ELSE
   SELECT * INTO p FROM owner_programs WHERE id=run.program_id FOR UPDATE;
   IF NOT FOUND OR p.owner_record_id<>owner.id OR p.owner_user_id<>_account_id THEN RAISE EXCEPTION 'Program identity changed. Review before retrying.'; END IF;
   IF p.status IN ('paused','closed','completed','complete') THEN RAISE EXCEPTION 'Paused or closed participation cannot be restarted through enrollment.'; END IF;
   IF _step='closing' THEN
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
   ELSIF _step='welcome' THEN
    PERFORM public.enroll_active_owner(home.id,_account_id);
    receipt:=jsonb_build_object('programId',p.id,'held',coalesce((SELECT value->>'review' FROM app_settings WHERE key='owner_welcome_template'),'draft')<>'approved');
   END IF;
   END IF;
 END IF;
 receipt:=coalesce(receipt,jsonb_build_object('programId',coalesce(p.id,run.program_id)));
 UPDATE active_owner_enrollment_runs SET checkpoints=checkpoints||jsonb_build_object(_step,receipt),updated_at=now() WHERE id=run.id;
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.active_owner_enrollment_step(uuid,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.active_owner_enrollment_step(uuid,text,jsonb,uuid) TO authenticated;