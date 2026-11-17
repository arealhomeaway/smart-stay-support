-- Preflight for design-review-director (read only).
SELECT format('onboarding-team-cleanup applied: %s (expect 1)', (SELECT count(*) FROM public.audit_log WHERE action = 'onboarding_team_cleanup.one_designer'))
UNION ALL SELECT format('step review settings with Designer reviewer from Lead Designer: %s (expect 1)',
  (SELECT count(*) FROM public.onboarding_step_review_settings s WHERE 'designer' = ANY(s.reviewer_roles) AND s.template_task_id IN (
     SELECT (e->>'id')::uuid FROM public.audit_log l, jsonb_array_elements(l.before_value->'step_review_settings') e WHERE l.action = 'onboarding_team_cleanup.one_designer')))
UNION ALL SELECT format('Task reviews with Designer reviewer from Lead Designer: %s (expect 1)',
  (SELECT count(*) FROM public.onboarding_task_reviews s WHERE 'designer' = ANY(s.reviewer_roles) AND s.id IN (
     SELECT (e->>'id')::uuid FROM public.audit_log l, jsonb_array_elements(l.before_value->'task_reviews') e WHERE l.action = 'onboarding_team_cleanup.one_designer')))
UNION ALL SELECT format('live template steps naming Lead Designer or Staging Team: %s (expect 13)', (SELECT count(*) FROM public.onboarding_template_tasks WHERE title ~* 'lead designer|staging team'))
UNION ALL SELECT format('open, not archived Tasks naming them: %s (expect 25)', (SELECT count(*) FROM public.onboarding_tasks WHERE title ~* 'lead designer|staging team' AND status = 'open' AND archived_at IS NULL))
UNION ALL SELECT format('Director of Onboarding role active: %s (expect true)', (SELECT active FROM public.functional_roles WHERE code = 'onboarding_director'));
