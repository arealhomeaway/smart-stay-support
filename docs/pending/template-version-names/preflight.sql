-- Preflight for template-version-names (read only).
SELECT format('design-review-director applied: %s (expect 1)', (SELECT count(*) FROM public.audit_log WHERE action = 'design_review_director.apply'))
UNION ALL SELECT format('saved version steps naming Lead Designer or Staging Team: %s in %s versions (expect 28 in 9)',
  (SELECT count(*) FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e WHERE e->>'title' ~* 'lead designer|staging team'),
  (SELECT count(DISTINCT v.id) FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e WHERE e->>'title' ~* 'lead designer|staging team'))
UNION ALL SELECT format('of those, names with no fixed rename: %s (expect 0)',
  (SELECT count(*) FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e
    WHERE e->>'title' ~* 'lead designer|staging team' AND NOT ((SELECT after_value->'renames' FROM public.audit_log WHERE action = 'design_review_director.apply' ORDER BY created_at DESC LIMIT 1) ? (e->>'title'))))
UNION ALL SELECT format('live template steps still naming them: %s (expect 0)', (SELECT count(*) FROM public.onboarding_template_tasks WHERE title ~* 'lead designer|staging team'))
UNION ALL SELECT format('version lock on: %s (expect O)', (SELECT tgenabled::text FROM pg_trigger WHERE tgname = 'block_template_version_mutation' AND tgrelid = 'public.onboarding_template_versions'::regclass));
