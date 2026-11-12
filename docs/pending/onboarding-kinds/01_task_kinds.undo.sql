-- Undo 01: stops copying kinds onto new Tasks and removes the value rules.
-- The two columns on each table stay (with what was saved), so no plan setting or Task kind is lost;
-- nothing in the app requires them, and the screens fall back to the approved rule without them.
DROP TRIGGER IF EXISTS onboarding_task_kind_from_step ON public.onboarding_tasks;
DROP FUNCTION IF EXISTS private.onboarding_task_kind_from_step();
ALTER TABLE public.onboarding_tasks DROP CONSTRAINT IF EXISTS onboarding_tasks_task_kind_check;
ALTER TABLE public.onboarding_template_tasks DROP CONSTRAINT IF EXISTS onboarding_template_tasks_task_kind_check;
