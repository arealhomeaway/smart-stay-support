-- Active Owner authority boundary (approved by Emily Jimenez, 8 Oct 2026):
-- enrollment, welcome Retry and uncertain-delivery Reconcile belong to the
-- Onboarding Director seat and Platform Owners (admin). Supervisor/manager,
-- Operations authority and Onboarding PM membership alone are not sufficient.
-- Changes an EXISTING permission: enroll_active_owner, create_owner_program and
-- change_owner_program('add_property') stop accepting manager-only callers the
-- moment this applies. No rows, statuses, seats or grants are changed.

CREATE OR REPLACE FUNCTION private.is_active_owner_authority(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    coalesce(public.has_role(_user_id, 'admin'), false)
    OR coalesce(public.is_onboarding_director(_user_id), false))
$$;
REVOKE ALL ON FUNCTION private.is_active_owner_authority(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_owner_authority(uuid) TO authenticated, service_role;

-- Demo-only rule for synthetic test accounts (0138/0141): these SECURITY DEFINER
-- paths bypass row security, so they repeat the rule here. A synthetic account
-- with qualifying authority may still enroll DEMO homes; it may never enroll,
-- add, link or retry anything on a real home.
CREATE OR REPLACE FUNCTION public.active_owner_may_act(_is_demo boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_active_owner_authority(auth.uid())
    AND (NOT coalesce(private.is_synthetic_account(), false) OR _is_demo IS TRUE)
$$;
REVOKE ALL ON FUNCTION public.active_owner_may_act(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_owner_may_act(boolean) TO authenticated, service_role;

-- enroll_active_owner: authority check narrowed and synthetic real-home guard added; body otherwise identical to 0147.
CREATE OR REPLACE FUNCTION public.enroll_active_owner(_property_id uuid, _owner_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; pid uuid; program public.owner_programs; account_email text; activated boolean := false;
  welcome_id uuid;
BEGIN
  IF NOT private.is_active_owner_authority(auth.uid()) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or a Platform Owner can set up an Active Owner.';
  END IF;
  IF coalesce(private.is_synthetic_account(), false)
     AND NOT EXISTS (SELECT 1 FROM public.properties WHERE id=_property_id AND is_demo IS TRUE) THEN
    RAISE EXCEPTION 'Test accounts can only set up Active Owner on demo homes.';
  END IF;
  SELECT email INTO account_email FROM auth.users WHERE id=_owner_user_id AND deleted_at IS NULL;
  IF account_email IS NULL THEN RAISE EXCEPTION 'Choose an enabled homeowner account.'; END IF;
  r := public.create_owner_program(_property_id);
  pid := (r->>'programId')::uuid;
  SELECT * INTO program FROM public.owner_programs WHERE id=pid;
  IF program.owner_user_id IS DISTINCT FROM _owner_user_id THEN
    IF program.is_demo THEN
      PERFORM public.link_demo_owner_account(pid, _owner_user_id, 'Active Owner setup');
    ELSE
      PERFORM public.staff_link_owner_account(pid, _owner_user_id);
    END IF;
    SELECT * INTO program FROM public.owner_programs WHERE id=pid;
  END IF;
  INSERT INTO public.owner_welcome_messages(program_id, owner_user_id, property_id, recipient, status, queued_by, is_demo)
  VALUES (pid, _owner_user_id, _property_id, account_email, CASE WHEN program.is_demo THEN 'held_demo' ELSE 'queued' END, auth.uid(), program.is_demo)
  ON CONFLICT (program_id, owner_user_id) DO NOTHING RETURNING id INTO welcome_id;
  IF welcome_id IS NOT NULL THEN
    INSERT INTO public.owner_program_events(program_id, property_id, kind, summary, actor_id, detail)
    VALUES (pid, _property_id, 'welcome_queued', 'Welcome email queued after Active Owner setup.', auth.uid(),
      jsonb_build_object('welcomeId', welcome_id, 'demo', program.is_demo));
  END IF;
  RETURN jsonb_build_object('programId', pid, 'alreadyEnrolled', coalesce((r->>'alreadyExists')::boolean,false),
    'participationOpen', coalesce((public.owner_hours_eligibility(pid)->>'eligible')::boolean,false), 'activatedNow', activated, 'welcomeQueued', welcome_id IS NOT NULL);
END $$;

-- create_owner_program and change_owner_program('add_property'): insert one
-- guard line into the live definitions, leaving every other line untouched.
-- Fails (and rolls back the whole migration) if the expected anchor is absent.
DO $mig$
DECLARE def text; anchor text; patched text;
BEGIN
  def := pg_get_functiondef('public.create_owner_program(uuid)'::regprocedure);
  anchor := E'BEGIN\n SELECT * INTO home FROM public.properties WHERE id=_property_id;';
  IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'create_owner_program anchor not found; review before applying.'; END IF;
  patched := replace(def, anchor, E'BEGIN\n IF NOT private.is_active_owner_authority(actor) THEN RAISE EXCEPTION ''Only the Onboarding Director or a Platform Owner can enroll a home in Active Owner.''; END IF;\n IF coalesce(private.is_synthetic_account(),false) AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=_property_id AND is_demo IS TRUE) THEN RAISE EXCEPTION ''Test accounts can only enroll demo homes.''; END IF;\n SELECT * INTO home FROM public.properties WHERE id=_property_id;');
  EXECUTE patched;

  def := pg_get_functiondef('public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure);
  anchor := E'BEGIN\n program:=private.owner_lifecycle_program(_program_id,_expected_version,true);';
  IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'change_owner_program anchor not found; review before applying.'; END IF;
  patched := replace(def, anchor, E'BEGIN\n IF _action=''add_property'' AND NOT private.is_active_owner_authority(auth.uid()) THEN RAISE EXCEPTION ''Only the Onboarding Director or a Platform Owner can enroll a home in Active Owner.''; END IF;\n IF _action=''add_property'' AND coalesce(private.is_synthetic_account(),false) AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=_property_id AND is_demo IS TRUE) THEN RAISE EXCEPTION ''Test accounts can only add demo homes.''; END IF;\n program:=private.owner_lifecycle_program(_program_id,_expected_version,true);');
  EXECUTE patched;

  -- staff_link_owner_account only serves real programs (demo links use
  -- link_demo_owner_account), so a synthetic caller is refused outright.
  -- Who else may link (admin, manager, Onboarding Director) is unchanged.
  def := pg_get_functiondef('public.staff_link_owner_account(uuid,uuid)'::regprocedure);
  anchor := E'BEGIN\n IF auth.uid() IS NULL OR NOT (';
  IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'staff_link_owner_account anchor not found; review before applying.'; END IF;
  patched := regexp_replace(def, E'BEGIN\n IF auth\\.uid\\(\\) IS NULL OR NOT \\(', E'BEGIN\n IF coalesce(private.is_synthetic_account(),false) THEN RAISE EXCEPTION ''Test accounts cannot link homeowner accounts to real programs.''; END IF;\n IF auth.uid() IS NULL OR NOT (');
  EXECUTE patched;
END $mig$;

-- Reconciliation function (PR #11), authority narrowed to the same boundary.
CREATE OR REPLACE FUNCTION public.reconcile_owner_welcome(_id uuid, _outcome text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.owner_welcome_messages; next_status text;
BEGIN
  IF NOT private.is_active_owner_authority(auth.uid()) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or a Platform Owner can reconcile a welcome.'; END IF;
  IF private.is_synthetic_account() THEN
    RAISE EXCEPTION 'Test accounts cannot reconcile real welcome deliveries.';
  END IF;
  IF _outcome IS NULL OR _outcome NOT IN ('delivered', 'not_delivered')
    OR length(trim(coalesce(_reason,''))) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Choose an outcome and record the mailbox/provider evidence.';
  END IF;
  SELECT * INTO w FROM public.owner_welcome_messages WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Welcome not found.'; END IF;
  IF w.is_demo OR w.recipient ~* '@(resolve-test\.invalid|[^@]+\.(invalid|test|example))$' THEN
    RAISE EXCEPTION 'Demo and test welcomes cannot be reconciled for sending.';
  END IF;
  -- Only a completed, ambiguous attempt can be reconciled; an in-flight send cannot.
  IF w.status <> 'sending' OR coalesce(w.error_message,'') NOT LIKE 'Delivery uncertain: %' THEN
    RAISE EXCEPTION 'This welcome is not awaiting delivery reconciliation. Refresh its status.';
  END IF;
  next_status := CASE WHEN _outcome='delivered' THEN 'sent' ELSE 'failed' END;
  UPDATE public.owner_welcome_messages SET status=next_status,
    error_message=CASE WHEN _outcome='delivered' THEN NULL ELSE 'Non-delivery confirmed: ' || trim(_reason) END
    WHERE id=w.id;
  -- sent_at is intentionally unchanged: the time of reconciliation is not the time of sending.
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, reason, before_value, after_value)
    VALUES(auth.uid(), 'owner_welcome.reconciled', 'owner_welcome_message', w.id, trim(_reason),
      jsonb_build_object('status',w.status,'attempts',w.attempts,'error',w.error_message),
      jsonb_build_object('status',next_status,'outcome',_outcome));
  RETURN jsonb_build_object('status',next_status,'reconciled',true);
END $$;
REVOKE ALL ON FUNCTION public.reconcile_owner_welcome(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_owner_welcome(uuid,text,text) TO authenticated;
