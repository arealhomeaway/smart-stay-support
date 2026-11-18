-- Practice for mark-done-breezeway on 3400 N Fern Avenue, signed in as the Director of Onboarding.
-- Old Mark done preview, apply, new preview, real Mark done of the four Tasks, checks, then a later
-- Breezeway "Finished" report. Always rolls back (ends with RAISE EXCEPTION 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _p(n serial, line text);
CREATE TEMP TABLE _ids AS SELECT t.id FROM public.onboarding_tasks t
  WHERE t.property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND t.status NOT IN ('complete','carryover','done') AND t.archived_at IS NULL
    AND EXISTS (SELECT 1 FROM public.breezeway_outbound_tasks b WHERE b.onboarding_task_id = t.id);
CREATE OR REPLACE FUNCTION pg_temp.bzfp() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(coalesce((SELECT string_agg(to_jsonb(b)::text, ',' ORDER BY b.id) FROM public.breezeway_outbound_tasks b WHERE b.onboarding_task_id IN (SELECT id FROM _ids)), '')
          || coalesce((SELECT string_agg(to_jsonb(l)::text, ',' ORDER BY l.task_id) FROM public.onboarding_task_breezeway_links l WHERE l.task_id IN (SELECT id FROM _ids)), '')
          || coalesce((SELECT string_agg(to_jsonb(w)::text, ',' ORDER BY w.breezeway_task_id) FROM public.breezeway_work_orders w WHERE w.breezeway_task_id IN (SELECT b.breezeway_task_id FROM public.breezeway_outbound_tasks b WHERE b.onboarding_task_id IN (SELECT id FROM _ids))), ''))
$f$;
INSERT INTO _p(line) SELECT 'Tasks on Fern with a sent work order: ' || (SELECT count(*) FROM _ids);
INSERT INTO _p(line) SELECT 'breezeway before: ' || pg_temp.bzfp();
SELECT set_config('request.jwt.claims', json_build_object('sub', '40de2f41-5596-4ec1-98d7-29e16549a25f', 'role', 'authenticated')::text, true);
INSERT INTO _p(line) SELECT 'before, preview: ' || (SELECT format('%s Tasks will be marked done; held: %s', jsonb_array_length(r->'ready'),
    (SELECT string_agg(DISTINCT h->>'reason', ' | ') FROM jsonb_array_elements(r->'held') h)))
  FROM (SELECT public.bulk_complete_onboarding_tasks('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', (SELECT array_agg(id) FROM _ids), 'preview', NULL, NULL, true) r) x;
-- @@APPLY@@
SELECT set_config('request.jwt.claims', json_build_object('sub', '40de2f41-5596-4ec1-98d7-29e16549a25f', 'role', 'authenticated')::text, true);
INSERT INTO _p(line) SELECT 'after, preview: ' || (SELECT format('%s Tasks will be marked done; Breezeway note Tasks: %s; held: %s', jsonb_array_length(r->'ready'),
    jsonb_array_length(r->'breezeway'), jsonb_array_length(r->'held')))
  FROM (SELECT public.bulk_complete_onboarding_tasks('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', (SELECT array_agg(id) FROM _ids), 'preview', NULL, NULL, true) r) x;
INSERT INTO _p(line) SELECT 'Mark done: ' || (SELECT format('completed %s, held %s', r->>'completed', jsonb_array_length(r->'held')))
  FROM (SELECT public.bulk_complete_onboarding_tasks('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', (SELECT array_agg(id) FROM _ids), 'Practice: proof is in the Breezeway work order', NULL, NULL, false) r) x;
INSERT INTO _p(line) SELECT format('Tasks now done by the Director of Onboarding: %s of %s',
  (SELECT count(*) FROM public.onboarding_tasks WHERE id IN (SELECT id FROM _ids) AND status = 'complete' AND completed_by = '40de2f41-5596-4ec1-98d7-29e16549a25f'),
  (SELECT count(*) FROM _ids));
INSERT INTO _p(line) SELECT format('audit rows for these completions: %s',
  (SELECT count(*) FROM public.audit_log WHERE action = 'onboarding_task_bulk_completed' AND entity_id IN (SELECT id FROM _ids) AND created_at >= now()));
INSERT INTO _p(line) SELECT 'breezeway after Mark done unchanged: ' || (pg_temp.bzfp() = (SELECT substr(line, 19) FROM _p WHERE line LIKE 'breezeway before: %'))::text;
CREATE TEMP TABLE _done AS SELECT id, completed_at, completed_by, status FROM public.onboarding_tasks WHERE id IN (SELECT id FROM _ids);
-- Breezeway later reports each work order Finished, through the integration path.
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
INSERT INTO _p(line) SELECT format('later Breezeway Finished reports that changed a Task: %s of %s (no error)',
  (SELECT count(*) FILTER (WHERE public.complete_onboarding_from_breezeway(b.id, b.breezeway_task_id, b.property_id, 'Finished', t.updated_at, p.updated_at, pr.updated_at, now()))
     FROM public.breezeway_outbound_tasks b JOIN public.onboarding_tasks t ON t.id = b.onboarding_task_id
     JOIN public.properties p ON p.id = b.property_id
     JOIN public.onboarding_projects pr ON pr.property_id = b.property_id AND pr.status <> 'cancelled'
    WHERE b.onboarding_task_id IN (SELECT id FROM _ids) AND b.breezeway_task_id IS NOT NULL),
  (SELECT count(*) FROM public.breezeway_outbound_tasks b WHERE b.onboarding_task_id IN (SELECT id FROM _ids) AND b.breezeway_task_id IS NOT NULL));
INSERT INTO _p(line) SELECT 'still done with the same completer and time: ' || NOT EXISTS (
  SELECT 1 FROM public.onboarding_tasks t JOIN _done d USING (id)
   WHERE t.status IS DISTINCT FROM d.status OR t.completed_at IS DISTINCT FROM d.completed_at OR t.completed_by IS DISTINCT FROM d.completed_by);
INSERT INTO _p(line) SELECT format('Completed in Breezeway rows written: %s',
  (SELECT count(*) FROM public.audit_log WHERE action = 'onboarding_task_completed_in_breezeway' AND entity_id IN (SELECT id FROM _ids) AND created_at >= now()));
INSERT INTO _p(line) SELECT 'Mark done still holds Blocked and review: ' || (SELECT prosrc LIKE '%''Blocked: '' || btrim(ot.blocker)%' AND prosrc LIKE '%Needs review first.%' AND prosrc NOT LIKE '%WHEN private.plan_catch_up_bz_sent(ot.id) THEN%'
  FROM pg_proc WHERE oid = 'public.bulk_complete_onboarding_tasks(uuid,uuid[],text,date,uuid,boolean)'::regprocedure)::text;
DO $d$ DECLARE s text; BEGIN
  SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK:%', E'\n' || s;
END $d$;
