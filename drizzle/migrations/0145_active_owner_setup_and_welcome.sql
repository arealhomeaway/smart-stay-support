CREATE TABLE IF NOT EXISTS public.owner_welcome_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id),
  owner_user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id),
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','held_demo')),
  template_version int,
  subject text,
  body text,
  video_url text,
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  queued_by uuid,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  UNIQUE (program_id, owner_user_id)
);
COMMENT ON TABLE public.owner_welcome_messages IS 'One initial Active Owner welcome per program + homeowner account. Stores the exact wording and template version used. Delivery status is separate from enrollment.';
GRANT SELECT ON public.owner_welcome_messages TO authenticated;
GRANT ALL ON public.owner_welcome_messages TO service_role;
ALTER TABLE public.owner_welcome_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Onboarding staff read welcome status" ON public.owner_welcome_messages
  FOR SELECT TO authenticated USING (public.is_onboarding_staff(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- One staff action: enroll the home, link the homeowner account, open participation
-- when a confirmed closing exists, and queue one welcome. Duplicate-safe on retry.
CREATE OR REPLACE FUNCTION public.enroll_active_owner(_property_id uuid, _owner_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; pid uuid; program public.owner_programs; account_email text; activated boolean := false;
  welcome_id uuid; has_confirmed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'manager'),false) OR coalesce(public.is_onboarding_director(auth.uid()),false)) THEN
    RAISE EXCEPTION 'Only a supervisor or the Onboarding Director can set up an Active Owner.';
  END IF;
  SELECT email INTO account_email FROM auth.users WHERE id=_owner_user_id AND deleted_at IS NULL;
  IF account_email IS NULL THEN RAISE EXCEPTION 'Choose an enabled homeowner account.'; END IF;
  r := public.create_owner_program(_property_id);
  pid := (r->>'programId')::uuid;
  SELECT * INTO program FROM public.owner_programs WHERE id=pid;
  IF program.owner_user_id IS DISTINCT FROM _owner_user_id THEN
    IF program.is_demo THEN
      PERFORM public.link_demo_owner_account(pid, _owner_user_id);
    ELSE
      PERFORM public.staff_link_owner_account(pid, _owner_user_id);
    END IF;
    SELECT * INTO program FROM public.owner_programs WHERE id=pid;
  END IF;
  IF program.status <> 'active' AND program.activated_at IS NULL THEN
    SELECT EXISTS(SELECT 1 FROM owner_program_properties e WHERE e.program_id=pid AND e.inclusion_status='included'
      AND e.archived_at IS NULL AND e.closing_confirmed AND e.closing_date IS NOT NULL) INTO has_confirmed;
    IF has_confirmed THEN
      PERFORM public.activate_owner_program(pid, program.report_version, NULL);
      activated := true;
    END IF;
  END IF;
  INSERT INTO public.owner_welcome_messages(program_id, owner_user_id, property_id, recipient, status, queued_by, is_demo)
  VALUES (pid, _owner_user_id, _property_id, account_email, CASE WHEN program.is_demo THEN 'held_demo' ELSE 'queued' END, auth.uid(), program.is_demo)
  ON CONFLICT (program_id, owner_user_id) DO NOTHING RETURNING id INTO welcome_id;
  IF welcome_id IS NOT NULL THEN
    INSERT INTO public.owner_program_events(program_id, property_id, kind, summary, actor_id, detail)
    VALUES (pid, _property_id, 'welcome_queued', 'Welcome email queued after Active Owner setup.', auth.uid(),
      jsonb_build_object('welcomeId', welcome_id, 'demo', program.is_demo));
  END IF;
  SELECT * INTO program FROM public.owner_programs WHERE id=pid;
  RETURN jsonb_build_object('programId', pid, 'alreadyEnrolled', coalesce((r->>'alreadyExists')::boolean,false),
    'participationOpen', program.status='active', 'activatedNow', activated, 'welcomeQueued', welcome_id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.enroll_active_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_active_owner(uuid, uuid) TO authenticated;