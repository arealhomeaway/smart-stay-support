-- closure-evidence-breezeway: preflight (read only). Every row must say ok = true before apply.
SELECT 'work type: Immediate maintenance' AS check, required_closure_evidence =
  'Photos before and after, what was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working' AS ok
  FROM public.work_types WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6' AND name = 'Immediate maintenance'
UNION ALL
SELECT 'work type: Ongoing maintenance', required_closure_evidence = 'Work performed, vendor, and photo of the completed work'
  FROM public.work_types WHERE id = 'a5b90e0e-39fc-4d96-860b-d77fb5b793d7' AND name = 'Ongoing maintenance'
UNION ALL
SELECT 'work type: Immediate cleaning need', required_closure_evidence = 'Photos of the cleaned area and who completed it'
  FROM public.work_types WHERE id = 'c2214621-8dd4-47d4-af73-8c77696850e7' AND name = 'Immediate cleaning need'
UNION ALL
SELECT 'maintenance checklist v1 is the live one, body unchanged',
  status = 'approved' AND version = 1 AND md5(checklist::text) = '4f570a26feb661a1d7fbc30e4719b040'
  AND checklist->'steps'->8->>'key' = 'done'
  AND checklist->'steps'->8->>'question' = 'Work done? Upload vendor photo or invoice.'
  FROM public.playbooks WHERE id = '7d0eb2a4-6fdc-4396-aebc-8a738af97722'
UNION ALL
SELECT 'only one live maintenance checklist', count(*) = 1
  FROM public.playbooks WHERE checklist IS NOT NULL AND checklist_category = 'maintenance' AND status = 'approved';
-- For the record (not a gate): open tickets pinned to maintenance v1, and existing ticket steps holding the old words.
SELECT (SELECT count(*) FROM public.tickets WHERE checklist_playbook_id = '7d0eb2a4-6fdc-4396-aebc-8a738af97722') AS tickets_on_v1,
       (SELECT count(*) FROM public.ticket_steps ts WHERE to_jsonb(ts)::text ILIKE '%upload vendor photo%') AS ticket_steps_with_old_words;
