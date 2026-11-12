-- Property page Part 1: read-only checks before apply.sql. Every row should read ok = true.
SELECT 'property_owners.preferred_method absent' AS check, NOT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_owners' AND column_name='preferred_method') AS ok
UNION ALL
SELECT 'property_owners.telegram absent', NOT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_owners' AND column_name='telegram')
UNION ALL
SELECT 'onboarding_tasks.is_one_off absent', NOT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='onboarding_tasks' AND column_name='is_one_off')
UNION ALL
SELECT 'onboarding_tasks link columns present', (SELECT count(*) = 4 FROM information_schema.columns WHERE table_schema='public' AND table_name='onboarding_tasks'
  AND column_name IN ('template_task_id','follow_up_of','carryover_of','created_by'))
UNION ALL
SELECT 'status stage map not set yet', NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key='onboarding_status_stage_map');
