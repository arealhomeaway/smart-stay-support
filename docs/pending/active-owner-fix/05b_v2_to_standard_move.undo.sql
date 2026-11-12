-- Exact undo of 05b from its receipts. Nothing is deleted:
--   the V2 Tasks 05b archived are un-archived (only rows still carrying the archive stamp 05b wrote);
--   the Standard Tasks 05b created, open or completed, are archived, recording who and when;
--   each project goes back to its prior plan version.
UPDATE public.onboarding_tasks t SET archived_at = NULL, archived_by = NULL
  FROM public.ao_plan_move_receipts r
 WHERE r.kind = 'archived_v2' AND r.task_id = t.id
   AND t.archived_at = r.archived_at AND t.archived_by IS NOT DISTINCT FROM r.actor_id;
UPDATE public.onboarding_tasks t SET archived_at = now(), archived_by = r.actor_id
  FROM public.ao_plan_move_receipts r
 WHERE r.kind IN ('created', 'created_done') AND r.task_id = t.id AND t.archived_at IS NULL;
UPDATE public.onboarding_projects p SET template_version_id = r.prior_version_id
  FROM public.ao_plan_move_receipts r WHERE r.kind = 'version' AND r.project_id = p.id;
