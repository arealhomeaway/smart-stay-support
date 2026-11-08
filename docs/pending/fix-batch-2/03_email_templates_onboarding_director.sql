-- Fix batch 2, item 3: the Director of Onboarding can save shared email templates
-- (create, change, retire). Reading stays exactly as it is (all staff).
-- Removing templates stays with Supervisors. Additive only.

CREATE POLICY "Director of Onboarding can create message templates" ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_onboarding_director(auth.uid()));

CREATE POLICY "Director of Onboarding can change message templates" ON public.email_templates
  FOR UPDATE TO authenticated
  USING (public.is_onboarding_director(auth.uid()))
  WITH CHECK (public.is_onboarding_director(auth.uid()));
