-- UNDO for 01_standard_template.sql. Refuses if any home started on version 2 or has Tasks from the new steps.
DO $do$ DECLARE v2 uuid; BEGIN
  SELECT id INTO v2 FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 2;
  IF v2 IS NOT NULL AND EXISTS (SELECT 1 FROM public.onboarding_projects WHERE template_version_id = v2) THEN
    RAISE EXCEPTION 'A home already started on Standard version 2; undo refused'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_tasks WHERE template_task_id IN ('5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26','5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58')) THEN
    RAISE EXCEPTION 'Homes have Tasks from the new steps; undo refused'; END IF;
END $do$;
ALTER TABLE public.onboarding_template_versions DISABLE TRIGGER block_template_version_mutation;
DELETE FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 2;
ALTER TABLE public.onboarding_template_versions ENABLE TRIGGER block_template_version_mutation;
DELETE FROM public.onboarding_step_review_settings WHERE template_task_id = '5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26';
DELETE FROM public.onboarding_template_tasks WHERE id IN ('5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26','5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58');
UPDATE public.onboarding_template_tasks SET is_active = true WHERE id IN ('3505c129-1c91-42db-955b-89c7bce75c11','cbb23216-ee09-4301-b0b0-4392a960a145');
