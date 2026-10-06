-- Synthetic test accounts (reserved test domains) may only read or change demo records.
CREATE OR REPLACE FUNCTION private.is_synthetic_account()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email ~* '@(resolve-test\.invalid|example\.(com|invalid)|demo\.arha\.test)$'
  )
$$;
REVOKE ALL ON FUNCTION private.is_synthetic_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_synthetic_account() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['properties','onboarding_tasks','onboarding_projects','documents','approvals','tickets','work_orders','work_items','expenses','claims','owner_programs','property_activity_log']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Synthetic accounts: demo records only" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "Synthetic accounts: demo records only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT (SELECT private.is_synthetic_account()) OR is_demo IS TRUE)
      WITH CHECK (NOT (SELECT private.is_synthetic_account()) OR is_demo IS TRUE)$p$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Synthetic accounts: demo records only" ON public.property_credentials;
CREATE POLICY "Synthetic accounts: demo records only" ON public.property_credentials AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT private.is_synthetic_account()) OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_demo))
  WITH CHECK (NOT (SELECT private.is_synthetic_account()) OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_demo));