-- homeowner-answer-review preflight (read only). Every row must say ok = true before apply.
SELECT 'review record not there yet' AS check, to_regclass('public.homeowner_answer_reviews') IS NULL AS ok
UNION ALL SELECT 'Reviewed action not there yet', NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'mark_homeowner_answer_reviewed')
UNION ALL SELECT 'helpers it uses exist', to_regprocedure('private.is_staff(uuid)') IS NOT NULL
  AND to_regprocedure('public.is_onboarding_director(uuid)') IS NOT NULL AND to_regprocedure('private.has_role(uuid,app_role)') IS NOT NULL
UNION ALL SELECT 'tables it reads exist', to_regclass('public.ao_home_plan_cards') IS NOT NULL AND to_regclass('public.owner_reviews') IS NOT NULL
  AND to_regclass('public.approvals') IS NOT NULL AND to_regclass('public.homeowner_updates') IS NOT NULL
  AND to_regclass('public.owner_review_properties') IS NOT NULL AND to_regclass('public.owner_program_properties') IS NOT NULL
UNION ALL SELECT 'not applied before', NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action LIKE 'homeowner_answer_review.%');
