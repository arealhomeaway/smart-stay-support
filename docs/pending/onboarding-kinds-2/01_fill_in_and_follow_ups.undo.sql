-- Undo for 01. Keeps both columns and their values (nothing is deleted); removes the rule and index
-- and marks the columns retired so the app treats them as not set up.
DROP TRIGGER IF EXISTS onboarding_follow_up_same_home ON public.onboarding_tasks;
DROP FUNCTION IF EXISTS private.onboarding_follow_up_same_home();
DROP INDEX IF EXISTS public.onboarding_tasks_follow_up_of_idx;
COMMENT ON COLUMN public.onboarding_tasks.follow_up_of IS 'DEPRECATED: 01_fill_in_and_follow_ups undone; values kept.';
COMMENT ON COLUMN public.onboarding_projects.inspection_on IS 'DEPRECATED: 01_fill_in_and_follow_ups undone; values kept.';
