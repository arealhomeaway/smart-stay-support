-- onboarding-roles-attach: preflight (read only). Every row must say ok = true before apply.
SELECT 'team rule unchanged since staged (md5)' AS check,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.set_onboarding_project_role(uuid,text,uuid,boolean)'::regprocedure) = 'dc182627c9d96da99e3c1367e3651191' AS ok
UNION ALL SELECT 'home project rules are the nine known ones',
  (SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger WHERE tgrelid = 'public.onboarding_projects'::regclass AND NOT tgisinternal)
  = 'ao_handoff_accepted,followed_home_handoff_notice,lock_committed_handoff,notify_onboarding_handoff_ready,onboarding_review_handoff_guard,protect_onboarding_project_assignments,protect_onboarding_project_gate_fields,recalc_plan_dates_on_anchor_change,update_onboarding_projects_updated_at'
UNION ALL SELECT 'Designer and Onboarding Manager roles have no holder; one person in each pool',
  (SELECT count(*) FROM public.functional_roles WHERE code IN ('designer','onboarding_manager') AND active AND current_seat_holder IS NULL) = 2
  AND (SELECT count(DISTINCT user_id) FROM public.functional_role_members WHERE role_code = 'designer') = 1
  AND (SELECT count(DISTINCT user_id) FROM public.functional_role_members WHERE role_code = 'onboarding_manager') = 1
UNION ALL SELECT 'repair would attach 65 open Tasks (Designer 36, Onboarding Manager 29)',
  (SELECT count(*) FILTER (WHERE t.assigned_seat = 'designer') || '/' || count(*) FILTER (WHERE t.assigned_seat = 'onboarding_manager')
     FROM public.onboarding_tasks t JOIN public.onboarding_projects op ON op.property_id = t.property_id
    WHERE op.status IN ('active','planning') AND NOT coalesce(op.is_demo,false)
      AND t.assigned_seat IN ('designer','onboarding_manager') AND nullif(op.role_assignments->>t.assigned_seat,'') IS NOT NULL
      AND t.assigned_to IS NULL AND t.status IN ('open','in_progress','blocked') AND t.archived_at IS NULL AND t.exception_at IS NULL) = '36/29'
UNION ALL SELECT 'no earlier repair recorded',
  NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action LIKE 'onboarding_roles_attach.%');
