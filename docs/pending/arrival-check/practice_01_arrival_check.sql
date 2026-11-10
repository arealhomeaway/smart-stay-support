-- Practice on the real database: the migration plus these steps, run as ONE transaction that
-- ends with an error on purpose, so nothing is kept. Fake booking numbers (practice-*) on the
-- 9211 Fitzgerald Dr. test home only.

DO $practice$
DECLARE
  _admin uuid := (SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1);
  _home uuid := '79319968-80c9-4f00-b6c9-608c0b1881dc';
  _out jsonb := '{}'::jsonb;
  _c1 uuid; _c2 uuid; _t1 uuid; _t2 uuid; _r jsonb; _e text;
BEGIN
  -- 1. The switch cannot be moved directly.
  BEGIN
    UPDATE public.feature_flags SET enabled = true WHERE key = 'arrival_checks';
    _out := _out || '{"direct_switch":"allowed"}';
  EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('direct_switch_refused', SQLERRM); END;
  -- 2. Start line Nov 19 and switch on (inside this cancelled practice only).
  PERFORM set_config('resolve.arrival_checks_switch', 'on', true);
  INSERT INTO public.app_settings(key, value) VALUES ('arrival_checks_start_line', '{"at":"2026-11-19T00:00:00Z"}')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  UPDATE public.feature_flags SET enabled = true WHERE key = 'arrival_checks';
  PERFORM set_config('resolve.arrival_checks_switch', '', true);
  -- 3. Three fake bookings on the test home, as the sync would store them.
  PERFORM public.arrival_ingest_bookings(jsonb_build_array(
    jsonb_build_object('id','practice-1','property_id',492500,'arrival','2026-11-20','departure','2026-11-22','status','active','type','booking','guest_id',900001,'guest',jsonb_build_object('first_name','Practice'),'adults',2,'pets',0,'booked_utc','2026-11-01T00:00:00Z'),
    jsonb_build_object('id','practice-2','property_id',492500,'arrival','2026-11-21','departure','2026-11-23','status','active','type','booking','guest_id',900002,'adults',1,'booked_utc','2026-11-01T00:00:00Z'),
    jsonb_build_object('id','practice-3','property_id',492500,'arrival','2026-11-20','departure','2026-11-21','status','cancelled','type','booking','guest_id',900003),
    jsonb_build_object('id','practice-4','property_id',492500,'arrival','2026-11-20','departure','2026-11-21','status','active','type','block','is_block',true,'title','Maintenance hold')));
  _out := _out || jsonb_build_object('run_559', private.arrival_checks_run('2026-11-20T11:59:00Z'));
  _out := _out || jsonb_build_object('run_600', private.arrival_checks_run('2026-11-20T12:00:00Z'));
  _out := _out || jsonb_build_object('run_601', private.arrival_checks_run('2026-11-20T12:01:00Z'));
  _out := _out || jsonb_build_object('skips', (SELECT jsonb_object_agg(ownerrez_booking_id, coalesce(decision_reason, decision)) FROM public.arrival_reservations WHERE ownerrez_booking_id LIKE 'practice-%'));
  SELECT id, ticket_id INTO _c1, _t1 FROM public.arrival_checks WHERE ownerrez_booking_id = 'practice-1';
  _out := _out || jsonb_build_object('check1', (SELECT jsonb_build_object('check_in', check_in_at, 'deadline', deadline_at, 'zone', time_zone, 'home', home_label) FROM public.arrival_checks WHERE id = _c1));
  _out := _out || jsonb_build_object('ticket1', (SELECT jsonb_build_object('assigned', assigned_to, 'priority', priority, 'due', due_at, 'role', functional_role_code, 'unowned_since', unowned_since, 'title', title) FROM public.tickets WHERE id = _t1));
  -- 4. Complete on time with an issue.
  _r := private.arrival_check_complete(_admin, _c1, true, NULL, true, 'issue', 'Practice issue', 'Practice backup plan', '2026-11-20T18:00:00Z');
  _out := _out || jsonb_build_object('complete1', _r);
  _out := _out || jsonb_build_object('ticket1_after', (SELECT jsonb_build_object('status', status, 'outcome', outcome_type) FROM public.tickets WHERE id = _t1));
  _out := _out || jsonb_build_object('facts1', (SELECT count(*) FROM public.scorecard_records WHERE kind = 'arrival_check' AND ticket_id = _t1));
  _out := _out || jsonb_build_object('fact1_demo', (SELECT is_demo FROM public.scorecard_records WHERE kind = 'arrival_check' AND ticket_id = _t1));
  -- 5. The second check: alert, then missed.
  _out := _out || jsonb_build_object('run_next_600', private.arrival_checks_run('2026-11-21T12:00:00Z'));
  SELECT id, ticket_id INTO _c2, _t2 FROM public.arrival_checks WHERE ownerrez_booking_id = 'practice-2';
  _out := _out || jsonb_build_object('run_alert', private.arrival_checks_run('2026-11-21T18:30:00Z'));
  _out := _out || jsonb_build_object('alert_rows', (SELECT jsonb_agg(title) FROM public.staff_notifications WHERE entity_id = _t2 AND kind = 'arrival_check_due'));
  _out := _out || jsonb_build_object('run_missed', private.arrival_checks_run('2026-11-21T21:00:00Z'));
  _out := _out || jsonb_build_object('missed_fact', (SELECT details ->> 'counts_for' FROM public.scorecard_records WHERE kind = 'arrival_check' AND ticket_id = _t2));
  _out := _out || jsonb_build_object('owner_rows', (SELECT count(*) FROM public.owner_notifications WHERE ticket_id IN (_t1, _t2))
                                   + (SELECT count(*) FROM public.owner_reviews WHERE ticket_id IN (_t1, _t2)));
  _out := _out || jsonb_build_object('lens', public.arrival_check_for_ticket(_t1) IS NULL);
  RAISE EXCEPTION 'PRACTICE RESULT (cancelled on purpose): %', _out::text;
END $practice$;
