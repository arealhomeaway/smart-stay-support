-- Undo 03: remove the Director of Onboarding template policies.
DROP POLICY IF EXISTS "Director of Onboarding can create message templates" ON public.email_templates;
DROP POLICY IF EXISTS "Director of Onboarding can change message templates" ON public.email_templates;
