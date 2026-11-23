-- onboarding-task-views preflight (read only). Every row must say ok = true before apply.
SELECT 'saved views record exists' AS check, to_regclass('public.saved_views') IS NOT NULL AS ok
UNION ALL SELECT 'page check is onboarding_home only', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_views_page_check'
  AND pg_get_constraintdef(oid) = 'CHECK ((page = ''onboarding_home''::text))')
UNION ALL SELECT 'kind check is view and columns', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_views_kind_check'
  AND pg_get_constraintdef(oid) = 'CHECK ((kind = ANY (ARRAY[''view''::text, ''columns''::text])))')
UNION ALL SELECT 'columns index exists, prefs index not yet', to_regclass('public.saved_views_one_columns') IS NOT NULL AND to_regclass('public.saved_views_one_prefs') IS NULL
UNION ALL SELECT 'new actions not there yet', NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('my_tasks_views', 'save_my_tasks_view', 'archive_my_tasks_view', 'save_my_tasks_prefs'))
UNION ALL SELECT 'columns action is the Nov 12 one', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'save_onboarding_home_columns' AND p.prosrc NOT LIKE '%''stager''%')
UNION ALL SELECT 'onboarding team check exists', to_regprocedure('public.is_onboarding_staff(uuid)') IS NOT NULL
UNION ALL SELECT 'only onboarding_home rows today', NOT EXISTS (SELECT 1 FROM public.saved_views WHERE page <> 'onboarding_home' OR kind NOT IN ('view', 'columns'))
UNION ALL SELECT 'not applied before', NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action LIKE 'onboarding_task_views.%');
