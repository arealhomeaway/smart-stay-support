-- UNDO for 04_push_v3_624_daniel_ct.sql. Run before undoing file 01. Refuses if any new Task was started.
DO $do$
DECLARE
  _proj constant uuid := 'e57c1c02-2600-4547-a3a9-cffa541ce4fc';
  _prop constant uuid := '2ac3120b-cec9-4735-b4b6-c130bdab63fd';
  _tpl  constant uuid := '84f3a777-44a8-430a-af7e-8f18dc9a7dae';
  v1 uuid; v3 uuid; mv timestamptz;
  ids uuid[] := ARRAY['6d24f3a1-7c1e-4c3a-9b2d-000000000a26','6d24f3a1-7c1e-4c3a-9b2d-000000000a58','6d24f3a1-7c1e-4c3a-9b2d-000000000b01','6d24f3a1-7c1e-4c3a-9b2d-000000000b02','6d24f3a1-7c1e-4c3a-9b2d-000000000b03']::uuid[];
BEGIN
  SELECT id INTO v1 FROM public.onboarding_template_versions WHERE template_id = _tpl AND version = 1;
  SELECT id INTO v3 FROM public.onboarding_template_versions WHERE template_id = _tpl AND version = 3;
  SELECT created_at INTO mv FROM public.onboarding_project_events WHERE id = '6d24f3a1-7c1e-4c3a-9b2d-000000000e01';
  IF (SELECT template_version_id FROM public.onboarding_projects WHERE id = _proj) IS DISTINCT FROM v3 OR mv IS NULL THEN RAISE EXCEPTION '624 Daniel Court is not on version 3 from file 04; undo refused'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_tasks WHERE id = ANY(ids) AND (status <> 'open' OR completed_at IS NOT NULL))
     OR EXISTS (SELECT 1 FROM public.onboarding_notes WHERE task_id = ANY(ids))
     OR EXISTS (SELECT 1 FROM public.onboarding_task_file_links WHERE receiving_task_id = ANY(ids) OR source_task_id = ANY(ids))
     OR EXISTS (SELECT 1 FROM public.onboarding_task_reviews WHERE task_id = ANY(ids)) THEN
    RAISE EXCEPTION 'A new Task has work on it; undo refused'; END IF;
  UPDATE public.ao_home_plan_cards SET linked_task_id = NULL WHERE linked_task_id = ANY(ids);
  DELETE FROM public.onboarding_tasks WHERE id = ANY(ids[3:5]);
  DELETE FROM public.onboarding_tasks WHERE id = ANY(ids[1:2]);
  -- Restore archived removed steps (only the ones file 04 archived)
  UPDATE public.onboarding_tasks SET archived_at = NULL, archived_by = NULL
   WHERE property_id = _prop AND archived_by = '98bd6696-4018-4965-b645-0471c5ae3925' AND archived_at = mv
     AND template_task_id IN ('00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f','3505c129-1c91-42db-955b-89c7bce75c11','cbb23216-ee09-4301-b0b0-4392a960a145');
  -- Restore version 1 wording on the two steps Kati edited, if still not started
  UPDATE public.onboarding_tasks t SET title = e1->>'title', detail = e1->>'detail', done_when = e1->>'done_when', description = e1->>'description'
    FROM public.onboarding_template_versions ov, jsonb_array_elements(ov.snapshot->'steps') e1
   WHERE ov.id = v1 AND e1->>'id' = t.template_task_id::text AND t.property_id = _prop AND t.status = 'open'
     AND t.template_task_id IN ('f5b2335f-3aed-44ce-af1a-c119ec66d6c3','36881d78-d434-489b-bf51-fd35022fe2e3');
  UPDATE public.onboarding_projects SET template_version_id = v1 WHERE id = _proj;
  DELETE FROM public.onboarding_project_events WHERE id = '6d24f3a1-7c1e-4c3a-9b2d-000000000e01';
END $do$;
