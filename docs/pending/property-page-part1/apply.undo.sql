-- Undo for docs/pending/property-page-part1/apply.sql. Run only with approval.
-- Removes exactly what apply.sql added. Any preferred method, Telegram or Admin edit to the
-- Status to stage map saved after apply is removed with it (export first if it must be kept).

DELETE FROM public.app_settings WHERE key = 'onboarding_status_stage_map';

DROP TRIGGER IF EXISTS onboarding_tasks_mark_one_off ON public.onboarding_tasks;
DROP FUNCTION IF EXISTS private.mark_onboarding_one_off();
ALTER TABLE public.onboarding_tasks DROP COLUMN IF EXISTS is_one_off;

ALTER TABLE public.property_owners
  DROP CONSTRAINT IF EXISTS property_owners_telegram_check,
  DROP CONSTRAINT IF EXISTS property_owners_preferred_method_check;
ALTER TABLE public.property_owners
  DROP COLUMN IF EXISTS telegram,
  DROP COLUMN IF EXISTS preferred_method;
