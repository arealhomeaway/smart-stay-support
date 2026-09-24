-- Pass 4: the Onboarding Director seat carries department-wide Onboarding
-- authority on its own, so Kati no longer needs the broad leadership
-- (`manager`) role, which also opened Operations.

CREATE OR REPLACE FUNCTION private.is_onboarding_leader(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT coalesce(private.is_supervisor(_user_id), false)
      OR coalesce(public.is_onboarding_director(_user_id), false)
$$;
REVOKE ALL ON FUNCTION private.is_onboarding_leader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_onboarding_leader(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_onboarding_leader(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public','private' AS $$
  SELECT private.is_onboarding_leader(_user_id)
$$;
REVOKE ALL ON FUNCTION public.is_onboarding_leader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_onboarding_leader(uuid) TO authenticated, service_role;

-- Workflow Templates: the Director manages them (content itself unchanged).
CREATE POLICY "Onboarding Director manages templates" ON public.onboarding_templates
  FOR ALL TO authenticated
  USING (public.is_onboarding_director(auth.uid())) WITH CHECK (public.is_onboarding_director(auth.uid()));
CREATE POLICY "Onboarding Director manages template stages" ON public.onboarding_template_stages
  FOR ALL TO authenticated
  USING (public.is_onboarding_director(auth.uid())) WITH CHECK (public.is_onboarding_director(auth.uid()));
CREATE POLICY "Onboarding Director manages template tasks" ON public.onboarding_template_tasks
  FOR ALL TO authenticated
  USING (public.is_onboarding_director(auth.uid())) WITH CHECK (public.is_onboarding_director(auth.uid()));

-- Project money lines and notes: same authority supervisors had inside Onboarding.
CREATE POLICY "Onboarding Director removes budget lines" ON public.onboarding_budget_lines
  FOR DELETE TO authenticated USING (public.is_onboarding_director(auth.uid()));
CREATE POLICY "Onboarding Director archives notes" ON public.onboarding_notes
  FOR UPDATE TO authenticated
  USING (public.is_onboarding_director(auth.uid())) WITH CHECK (public.is_onboarding_director(auth.uid()));

-- Onboarding-only actions that required the supervisor check now accept the
-- Onboarding Director too. Only the authority test changes.
DO $mig$
DECLARE f text; def text; n int;
BEGIN
  FOREACH f IN ARRAY ARRAY['publish_onboarding_template','instantiate_onboarding_v2','override_onboarding_task_date'] LOOP
    SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=f;
    IF n <> 1 THEN RAISE EXCEPTION 'Expected one %, found %', f, n; END IF;
    SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=f;
    IF position('public.is_supervisor(' in def) = 0 THEN RAISE EXCEPTION 'No supervisor check in %', f; END IF;
    EXECUTE replace(def, 'public.is_supervisor(', 'private.is_onboarding_leader(');
  END LOOP;
END $mig$;

-- Remove Kati Hand's general leadership role. Her Onboarding role and the
-- Onboarding Director seat remain untouched.
DELETE FROM public.user_roles
 WHERE user_id = '40de2f41-5596-4ec1-98d7-29e16549a25f' AND role = 'manager';