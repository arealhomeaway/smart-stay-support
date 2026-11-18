-- Preflight for mark-done-breezeway (read only).
SELECT format('open, not archived Tasks with a sent Breezeway work order: %s on %s homes (expect 24 on 3)',
  (SELECT count(*) FROM public.onboarding_tasks t WHERE t.status NOT IN ('complete','carryover','done') AND t.archived_at IS NULL
     AND EXISTS (SELECT 1 FROM public.breezeway_outbound_tasks b WHERE b.onboarding_task_id = t.id)),
  (SELECT count(DISTINCT t.property_id) FROM public.onboarding_tasks t WHERE t.status NOT IN ('complete','carryover','done') AND t.archived_at IS NULL
     AND EXISTS (SELECT 1 FROM public.breezeway_outbound_tasks b WHERE b.onboarding_task_id = t.id)))
UNION ALL SELECT format('live Mark done still holds them: %s (expect true)',
  (SELECT prosrc LIKE '%WHEN private.plan_catch_up_bz_sent(ot.id) THEN%' FROM pg_proc WHERE oid = 'public.bulk_complete_onboarding_tasks(uuid,uuid[],text,date,uuid,boolean)'::regprocedure))
UNION ALL SELECT format('live definition matches live-capture: check with pg_get_functiondef (md5 %s)',
  (SELECT md5(pg_get_functiondef('public.bulk_complete_onboarding_tasks(uuid,uuid[],text,date,uuid,boolean)'::regprocedure))));
