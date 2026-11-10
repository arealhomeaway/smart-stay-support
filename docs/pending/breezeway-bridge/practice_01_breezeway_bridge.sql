-- Practice run of 01_breezeway_bridge.sql on a real verified home with real Admin and non Admin
-- accounts. Run as: the full text of 01_breezeway_bridge.sql, then this file, in one step.
-- Cancelled at the end: nothing is kept (tickets, reviews, records, switch, start line, sweep).
-- Fake Breezeway task numbers 990000001 to 990000009 are used; nothing is sent to Breezeway.
CREATE TEMP TABLE practice_result(k text, v text);
CREATE TEMP TABLE practice_ids AS
SELECT 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03'::uuid AS prop,
       '768854'::text AS home,
       '98bd6696-4018-4965-b645-0471c5ae3925'::uuid AS admin_id,
       '452f6db5-ba38-44bf-a8bd-f4b9197a0032'::uuid AS other_id;

CREATE FUNCTION pg_temp.as_user(_id uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', _id::text, true);
$$;
CREATE FUNCTION pg_temp.try(_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE _sql;
  RETURN 'allowed';
EXCEPTION WHEN OTHERS THEN
  RETURN 'refused: ' || SQLERRM;
END $$;
CREATE FUNCTION pg_temp.mirror(_task bigint, _prop uuid, _home text, _dept text, _status text, _stage text,
                               _issue boolean, _created timestamptz, _updated timestamptz,
                               _finished timestamptz, _tags text[], _priority text DEFAULT 'normal')
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.breezeway_work_orders
    (breezeway_task_id, property_id, breezeway_home_id, name, description, department, priority,
     status, stage, breezeway_created_at, breezeway_updated_at, finished_at, reported_issue, tags,
     report_url, last_synced_at)
  VALUES (_task, _prop, _home, 'Practice task ' || _task, 'Practice description', _dept, _priority,
          _status, _stage, _created, _updated, _finished, _issue, _tags,
          CASE WHEN _issue THEN 'https://portal.breezeway.io/task/report/practice' || _task END, now())
  ON CONFLICT (breezeway_task_id) DO UPDATE SET
    name = EXCLUDED.name || ' (update)', status = EXCLUDED.status, stage = EXCLUDED.stage,
    breezeway_updated_at = EXCLUDED.breezeway_updated_at, finished_at = EXCLUDED.finished_at,
    last_synced_at = now();
$$;

INSERT INTO practice_result SELECT 'internal_work_orders_flag',
  (SELECT enabled::text FROM public.feature_flags WHERE key = 'internal_work_orders');
INSERT INTO practice_result SELECT 'bridge_before', (SELECT enabled::text FROM public.feature_flags WHERE key = 'breezeway_bridge');
INSERT INTO practice_result SELECT 'sweep_before', (SELECT active::text FROM cron.job WHERE jobname = 'breezeway-safety-sweep');

-- The switch cannot be flipped directly, and the start line cannot be moved directly.
INSERT INTO practice_result SELECT 'direct_flag_update',
  pg_temp.try($q$UPDATE public.feature_flags SET enabled = true WHERE key = 'breezeway_bridge'$q$);
INSERT INTO practice_result SELECT 'direct_start_line',
  pg_temp.try($q$INSERT INTO public.app_settings (key, value) VALUES ('breezeway_bridge_start_line', '{"at":"2020-01-01T00:00:00Z"}')$q$);

-- Only an Admin turns it on.
SELECT pg_temp.as_user(other_id) FROM practice_ids;
INSERT INTO practice_result SELECT 'turn_on_by_non_admin', pg_temp.try('SELECT public.set_breezeway_bridge(true)');
INSERT INTO practice_result SELECT 'status_by_non_admin', pg_temp.try('SELECT public.breezeway_bridge_status()');
SELECT pg_temp.as_user(admin_id) FROM practice_ids;
INSERT INTO practice_result SELECT 'turn_on_by_admin', public.set_breezeway_bridge(true)::text;
INSERT INTO practice_result SELECT 'sweep_after_on', (SELECT active::text FROM cron.job WHERE jobname = 'breezeway-safety-sweep');
INSERT INTO practice_result SELECT 'start_line_1', private.breezeway_bridge_start_line()::text;
INSERT INTO practice_result SELECT 'switch_history_rows',
  (SELECT count(*)::text FROM public.integration_events WHERE operation = 'bridge_switch' AND resolved_by = (SELECT admin_id FROM practice_ids));

-- A. Reported issue after the start line on a verified home: one ticket.
SELECT pg_temp.mirror(990000001, prop, home, 'maintenance', 'Created', 'new', true,
       clock_timestamp() + interval '1 minute', clock_timestamp() + interval '1 minute', NULL, '{}') FROM practice_ids;
-- B. A second update to the same task: no second ticket.
SELECT pg_temp.mirror(990000001, prop, home, 'maintenance', 'In Progress', 'in_progress', true,
       clock_timestamp() + interval '1 minute', clock_timestamp() + interval '2 minute', NULL, '{}') FROM practice_ids;
INSERT INTO practice_result SELECT 'issue_tickets',
  (SELECT count(*)::text FROM public.tickets WHERE external_source = 'breezeway' AND external_id = '990000001');
INSERT INTO practice_result SELECT 'issue_ticket_shape',
  (SELECT json_build_object('priority', priority, 'status', status, 'source', source_channel,
          'assigned_to', assigned_to, 'owner', current_action_owner, 'home_ok', property_id = (SELECT prop FROM practice_ids),
          'link', external_url, 'linked', (SELECT linked_ticket_id = t.id FROM public.breezeway_work_orders WHERE breezeway_task_id = 990000001),
          'kept', (SELECT bridge_keep FROM public.breezeway_work_orders WHERE breezeway_task_id = 990000001),
          'due_at_set', due_at IS NOT NULL)::text
     FROM public.tickets t WHERE external_source = 'breezeway' AND external_id = '990000001');
INSERT INTO practice_result SELECT 'issue_created_records',
  (SELECT count(*)::text FROM public.breezeway_bridge_records WHERE breezeway_task_id = 990000001 AND outcome = 'created');
-- Urgent priority comes through.
SELECT pg_temp.mirror(990000009, prop, home, 'maintenance', 'Created', 'new', true,
       clock_timestamp() + interval '1 minute', clock_timestamp() + interval '1 minute', NULL, '{}', 'urgent') FROM practice_ids;
INSERT INTO practice_result SELECT 'urgent_issue_priority',
  (SELECT priority FROM public.tickets WHERE external_source = 'breezeway' AND external_id = '990000009');

-- C. An older reported issue (before the start line), first seen now: skipped, no ticket.
SELECT pg_temp.mirror(990000002, prop, home, 'maintenance', 'Created', 'new', true,
       now() - interval '1 day', now() - interval '1 day', NULL, '{}') FROM practice_ids;
INSERT INTO practice_result SELECT 'old_issue_tickets',
  (SELECT count(*)::text FROM public.tickets WHERE external_source = 'breezeway' AND external_id = '990000002');
INSERT INTO practice_result SELECT 'old_issue_reason',
  (SELECT string_agg(reason, ',') FROM public.breezeway_bridge_records WHERE breezeway_task_id = 990000002);

-- D. Finished maintenance after the start line: one review, due 24 hours after the finish.
SELECT pg_temp.mirror(990000003, prop, home, 'maintenance', 'Finished', 'finished', false,
       now() - interval '3 day', clock_timestamp() + interval '3 minute', clock_timestamp() + interval '2 minute', '{}') FROM practice_ids;
-- E. Approved later (same task): no second review.
SELECT pg_temp.mirror(990000003, prop, home, 'maintenance', 'Approved', 'finished', false,
       now() - interval '3 day', clock_timestamp() + interval '5 minute', clock_timestamp() + interval '2 minute', '{}') FROM practice_ids;
INSERT INTO practice_result SELECT 'reviews',
  (SELECT count(*)::text FROM public.routine_controls r JOIN public.breezeway_work_orders w ON r.event_key = 'bz_maint:' || w.id
    WHERE w.breezeway_task_id = 990000003);
INSERT INTO practice_result SELECT 'review_shape',
  (SELECT json_build_object('kind', r.kind, 'status', r.status, 'team', r.team,
          'due_minus_finish_hours', extract(epoch FROM r.due_at - w.finished_at) / 3600,
          'kept', w.bridge_keep)::text
     FROM public.routine_controls r JOIN public.breezeway_work_orders w ON r.event_key = 'bz_maint:' || w.id
    WHERE w.breezeway_task_id = 990000003);

-- F. New House (tag on the task): skipped.
SELECT pg_temp.mirror(990000004, prop, home, 'maintenance', 'Finished', 'finished', false,
       now() - interval '3 day', clock_timestamp() + interval '3 minute', clock_timestamp() + interval '2 minute', ARRAY['New House']) FROM practice_ids;
INSERT INTO practice_result SELECT 'new_house_reason',
  (SELECT string_agg(outcome || ':' || reason, ',') FROM public.breezeway_bridge_records WHERE breezeway_task_id = 990000004);

-- G. A home that is not a verified Resolve home (other company): skipped, home recorded.
SELECT pg_temp.mirror(990000005, NULL, '1', 'maintenance', 'Finished', 'finished', false,
       now() - interval '3 day', clock_timestamp() + interval '3 minute', clock_timestamp() + interval '2 minute', '{}');
INSERT INTO practice_result SELECT 'other_home_reason',
  (SELECT string_agg(outcome || ':' || reason || ':home ' || breezeway_home_id, ',') FROM public.breezeway_bridge_records WHERE breezeway_task_id = 990000005);

-- H. Finished cleaning and inspection: no review (Departure Review covers cleaning).
SELECT pg_temp.mirror(990000006, prop, home, 'housekeeping', 'Finished', 'finished', false,
       now() - interval '3 day', clock_timestamp() + interval '3 minute', clock_timestamp() + interval '2 minute', '{}') FROM practice_ids;
SELECT pg_temp.mirror(990000010, prop, home, 'inspection', 'Finished', 'finished', false,
       now() - interval '3 day', clock_timestamp() + interval '3 minute', clock_timestamp() + interval '2 minute', '{}') FROM practice_ids;
INSERT INTO practice_result SELECT 'cleaning_inspection_records',
  (SELECT count(*)::text FROM public.breezeway_bridge_records WHERE breezeway_task_id IN (990000006, 990000010));

-- Maintenance finished before the start line, first seen now: skipped.
SELECT pg_temp.mirror(990000007, prop, home, 'maintenance', 'Finished', 'finished', false,
       now() - interval '3 day', now() - interval '2 day', now() - interval '2 day', '{}') FROM practice_ids;
INSERT INTO practice_result SELECT 'old_finish_reason',
  (SELECT string_agg(reason, ',') FROM public.breezeway_bridge_records WHERE breezeway_task_id = 990000007);

-- Status for the Integrations panel.
INSERT INTO practice_result SELECT 'status',
  (SELECT jsonb_build_object('enabled', s->'enabled', 'sweep_active', s->'sweep_active', 'tickets', s->'tickets_created',
          'reviews', s->'reviews_created', 'skipped', s->'skipped', 'by_reason', s->'skipped_by_reason')::text
     FROM (SELECT public.breezeway_bridge_status() s) x);

-- I. Turn off: creation stops, the sweep stops, nothing is recorded.
INSERT INTO practice_result SELECT 'turn_off_by_admin', public.set_breezeway_bridge(false)::text;
INSERT INTO practice_result SELECT 'sweep_after_off', (SELECT active::text FROM cron.job WHERE jobname = 'breezeway-safety-sweep');
SELECT pg_temp.mirror(990000008, prop, home, 'maintenance', 'Created', 'new', true,
       clock_timestamp() + interval '1 minute', clock_timestamp() + interval '1 minute', NULL, '{}') FROM practice_ids;
INSERT INTO practice_result SELECT 'off_issue_tickets_and_records',
  (SELECT count(*)::text FROM public.tickets WHERE external_id = '990000008' AND external_source = 'breezeway')
  || '/' || (SELECT count(*)::text FROM public.breezeway_bridge_records WHERE breezeway_task_id = 990000008);

-- The start line only moves forward when turned on again.
SELECT pg_sleep(1.2);
INSERT INTO practice_result SELECT 'turn_on_again', public.set_breezeway_bridge(true)::text;
INSERT INTO practice_result SELECT 'start_line_2', private.breezeway_bridge_start_line()::text;
SELECT public.set_breezeway_bridge(false);

-- No internal work orders while the switch is off: a real work order and an outbound task are refused.
INSERT INTO practice_result SELECT 'work_order_insert',
  pg_temp.try($q$INSERT INTO public.work_orders (title, property_id, is_demo) VALUES ('Practice', 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03', false)$q$);
INSERT INTO practice_result SELECT 'outbound_insert',
  pg_temp.try($q$INSERT INTO public.breezeway_outbound_tasks (source_type, breezeway_home_id, request_key, title) VALUES ('ticket', '768854', 'practice-key', 'Practice')$q$);

-- Older mirror rows keep working.
INSERT INTO practice_result SELECT 'mirror_rows_with_new_columns_empty',
  (SELECT count(*)::text FROM public.breezeway_work_orders WHERE breezeway_task_id < 990000000 AND reported_issue IS NULL AND tags IS NULL);

DO $practice$ BEGIN
  RAISE EXCEPTION 'PRACTICE CANCELLED %', (SELECT json_object_agg(k, v) FROM practice_result);
END $practice$;
