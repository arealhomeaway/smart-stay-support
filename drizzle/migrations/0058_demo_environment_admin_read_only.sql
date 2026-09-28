DROP POLICY IF EXISTS "demo_environment_select_authenticated" ON public.demo_environment;
CREATE POLICY "demo_environment_select_admin"
  ON public.demo_environment FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));