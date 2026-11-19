-- ticket-page-fixes: preflight (read only). Every row must say ok = true before apply.
SELECT 'answer guard is the current one' AS check, md5(pg_get_functiondef('private.guard_checklist_answer'::regproc)) = 'c4520d75fa033d235abd9b89a6e99995' AS ok
UNION ALL
SELECT 'answer guard trigger on ticket_steps', count(*) = 1 FROM pg_trigger
  WHERE tgrelid = 'public.ticket_steps'::regclass AND tgname = 'ticket_steps_checklist_answer'
  AND tgfoid = 'private.guard_checklist_answer'::regproc
UNION ALL
SELECT 'team policy on ticket_steps allows update', count(*) = 1 FROM pg_policy
  WHERE polrelid = 'public.ticket_steps'::regclass AND polname = 'ticket_steps_staff' AND polcmd = '*'
UNION ALL
SELECT 'work type: Immediate maintenance', required_closure_evidence = 'What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working'
  FROM public.work_types WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6' AND name = 'Immediate maintenance'
UNION ALL
SELECT 'maintenance checklist v2 is the live one, body unchanged',
  status = 'approved' AND version = 2 AND md5(checklist::text) = 'bcf7e0b4d9f60020cc7d56df1276a8e0'
  AND checklist->'steps'->8->>'key' = 'done'
  AND checklist->'steps'->8->'options' = '[{"label": "Uploaded", "value": "uploaded"}]'::jsonb
  FROM public.playbooks WHERE id = 'bdaa20f2-d1d9-4258-80e0-39bc4db869cc'
UNION ALL
SELECT 'only one live maintenance checklist', count(*) = 1
  FROM public.playbooks WHERE checklist IS NOT NULL AND checklist_category = 'maintenance' AND status = 'approved';
-- For the record (not a gate).
SELECT (SELECT count(*) FROM public.tickets WHERE checklist_playbook_id = 'bdaa20f2-d1d9-4258-80e0-39bc4db869cc') AS tickets_on_v2,
       (SELECT count(*) FROM public.ticket_steps WHERE step_key IS NOT NULL) AS answered_steps;
