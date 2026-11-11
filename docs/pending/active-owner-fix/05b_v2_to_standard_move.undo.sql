-- Exact undo of 05b from its receipts: archives the Tasks it created, brings back the V2 Tasks it
-- archived and puts each project back on its prior plan version. Nothing is deleted.
UPDATE public.onboarding_tasks t SET archived_at = now()
  FROM public.ao_plan_move_receipts r WHERE r.kind = 'created' AND r.task_id = t.id AND t.archived_at IS NULL;
UPDATE public.onboarding_tasks t SET archived_at = NULL, archived_by = NULL
  FROM public.ao_plan_move_receipts r WHERE r.kind = 'archived_v2' AND r.task_id = t.id;
UPDATE public.onboarding_projects p SET template_version_id = r.prior_version_id
  FROM public.ao_plan_move_receipts r WHERE r.kind = 'version' AND r.project_id = p.id;
