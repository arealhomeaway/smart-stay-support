-- Preflight for onboarding-team-cleanup (read only). Every line must read ok before apply.
WITH c AS (
  SELECT
    (SELECT count(*) FROM public.functional_role_members WHERE role_code IN ('lead_designer','design_staging')) AS pool_old,
    (SELECT count(*) FROM public.functional_role_members WHERE role_code = 'staging_team') AS pool_staging,
    (SELECT count(*) FROM public.functional_roles WHERE code IN ('lead_designer','design_staging','staging_team') AND active) AS roles_on,
    (SELECT count(*) FROM public.onboarding_projects WHERE role_assignments ?| ARRAY['lead_designer','design_staging']) AS homes,
    (SELECT count(*) FROM public.onboarding_projects p WHERE role_assignments ?| ARRAY['lead_designer','design_staging']
       AND (SELECT count(DISTINCT e.value) FROM jsonb_each_text(p.role_assignments) e
             WHERE e.key IN ('lead_designer','designer','design_staging') AND coalesce(e.value,'') <> '') > 1) AS conflicts,
    (SELECT count(*) FROM public.onboarding_template_tasks WHERE functional_role IN ('lead_designer','design_staging')
       OR role IN ('Lead Designer','Design & Staging','Design & Staging (older steps)')) AS tmpl,
    (SELECT count(*) FROM public.onboarding_template_tasks WHERE functional_role = 'staging_team') AS tmpl_staging,
    (SELECT count(*) FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e
       WHERE e->>'functional_role' IN ('lead_designer','design_staging') OR e->>'role' IN ('Lead Designer','Design & Staging','Design & Staging (older steps)')) AS version_steps,
    (SELECT count(*) FROM public.onboarding_tasks WHERE assigned_seat IN ('lead_designer','design_staging')) AS tasks,
    (SELECT count(*) FROM public.onboarding_tasks WHERE assigned_seat = 'staging_team') AS tasks_staging,
    (SELECT count(*) FROM public.work_items WHERE functional_role IN ('lead_designer','design_staging')) AS work_items,
    (SELECT count(*) FROM public.onboarding_step_review_settings WHERE reviewer_roles && ARRAY['lead_designer','design_staging']) AS rev,
    (SELECT count(*) FROM public.onboarding_task_reviews WHERE reviewer_roles && ARRAY['lead_designer','design_staging']) AS trev,
    (SELECT count(*) FROM public.vendor_orgs WHERE replace(lower(coalesce(legacy_notion_id,'')),'-','') LIKE '%4174658d5f4f8093a9fff46dac51e96e%') AS assem,
    (SELECT count(*) FROM public.onboarding_project_stagers WHERE project_id = '5aa876df-fd59-41af-9e39-b528d51fdc74' AND removed_at IS NULL) AS comstock_stagers,
    (SELECT count(*) FROM (SELECT project_id FROM public.onboarding_project_stagers WHERE removed_at IS NULL GROUP BY 1 HAVING count(*) > 1) q) AS multi_stager_homes,
    (SELECT count(*) FROM public.onboarding_projects WHERE id = '5aa876df-fd59-41af-9e39-b528d51fdc74') AS comstock
)
SELECT format('pool members on old codes: %s (expect 2) %s', pool_old, CASE WHEN pool_old = 2 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('Staging Team pool: %s (expect 0) %s', pool_staging, CASE WHEN pool_staging = 0 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('retired roles still on: %s (expect 3) %s', roles_on, CASE WHEN roles_on = 3 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('homes with old designer keys: %s (expect 5) %s', homes, CASE WHEN homes = 5 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('homes with conflicting designers: %s (expect 0) %s', conflicts, CASE WHEN conflicts = 0 THEN 'ok' ELSE 'STOP: list them' END) FROM c
UNION ALL SELECT format('template steps to move: %s (expect 8) %s', tmpl, CASE WHEN tmpl = 8 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('template steps on Staging Team: %s (expect 0) %s', tmpl_staging, CASE WHEN tmpl_staging = 0 THEN 'ok' ELSE 'STOP: list them' END) FROM c
UNION ALL SELECT format('published version steps to move: %s (expect 25) %s', version_steps, CASE WHEN version_steps = 25 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('Tasks to move: %s (expect 39) %s', tasks, CASE WHEN tasks = 39 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('Tasks on Staging Team: %s (expect 0) %s', tasks_staging, CASE WHEN tasks_staging = 0 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('work items to move: %s (expect 39) %s', work_items, CASE WHEN work_items = 39 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('step review settings to move: %s (expect 1) %s', rev, CASE WHEN rev = 1 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('Task reviews to move: %s (expect 1) %s', trev, CASE WHEN trev = 1 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('Assem Please already on file: %s (expect 0; 1 means skip create) %s', assem, CASE WHEN assem <= 1 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('8738 Comstock Ct stagers now: %s (expect 0) %s', comstock_stagers, CASE WHEN comstock_stagers = 0 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('homes with more than one stager: %s (expect 0) %s', multi_stager_homes, CASE WHEN multi_stager_homes = 0 THEN 'ok' ELSE 'STOP' END) FROM c
UNION ALL SELECT format('8738 Comstock Ct project found: %s %s', comstock, CASE WHEN comstock = 1 THEN 'ok' ELSE 'STOP' END) FROM c;
