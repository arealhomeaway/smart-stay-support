-- Undo for handoff-ready-alert.sql. Neither object exists live before applying (checked read-only).
DROP TRIGGER IF EXISTS notify_onboarding_handoff_ready ON public.onboarding_projects;
DROP FUNCTION IF EXISTS public.notify_onboarding_handoff_ready();
