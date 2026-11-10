-- Cancelled live check of the applied step (nothing kept). Run Nov 10 2026 UTC
-- (Mon Nov 9, about 7:30 PM Central: the Property Operations evening coordinator is on
-- shift, the weekday day coordinator is not). The deliberate error at the end cancels everything.
DO $final$
DECLARE
  _home uuid := 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03';
  _a uuid := '1a4b8de5-0824-4066-8691-8e6bb912f964';   -- Property Operations weekday day coordinator
  _b uuid := '29380b2b-a59f-4de4-8588-7bcfebfc2d36';   -- Property Operations evening coordinator
  _sup uuid := 'ea6708cd-7f53-4b36-bec8-f5b2a597e6db'; -- Operations Supervisor
  _wt uuid := 'e110029f-e2e9-4693-b26c-c528194f96c6';
  _out text := '';
  _t1 uuid; _t2 uuid; _t3 uuid; _res jsonb; _r record; _h record; _n int; _n2 int; _req uuid; _err text;
  _items jsonb;
BEGIN
  -- Two open tickets owned by coordinator A (one Right now, one Today), one more for the role check.
  INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind,
    category, functional_role_code, suggested_priority, priority, source_channel, reported_at, created_by, record_owner, accountable_owner, status)
  SELECT false, 'active_task', 'PRACTICE Leak', 'PRACTICE Leak', _home, wt.id, 'maintenance',
    wt.category, 'po_day', 'p1', 'p1', 'guest_message', now(), _a, _a, _a, 'open'
  FROM public.work_types wt WHERE wt.id = _wt RETURNING id INTO _t1;
  INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind,
    category, functional_role_code, suggested_priority, priority, source_channel, reported_at, created_by, record_owner, accountable_owner, status)
  SELECT false, 'active_task', 'PRACTICE Wifi', 'PRACTICE Wifi', _home, wt.id, 'maintenance',
    wt.category, 'po_day', 'p2', 'p2', 'guest_message', now(), _a, _a, _a, 'open'
  FROM public.work_types wt WHERE wt.id = _wt RETURNING id INTO _t2;
  INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind,
    category, functional_role_code, suggested_priority, priority, source_channel, reported_at, created_by, record_owner, accountable_owner, status)
  SELECT false, 'active_task', 'PRACTICE Gate', 'PRACTICE Gate', _home, wt.id, 'maintenance',
    wt.category, 'po_day', 'p3', 'p3', 'guest_message', now(), _a, _a, _a, 'open'
  FROM public.work_types wt WHERE wt.id = _wt RETURNING id INTO _t3;
  UPDATE public.tickets SET assigned_to = _a, current_action_owner = _a WHERE id IN (_t1, _t2, _t3);

  -- Defaults: the routing function at the handoff time.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOR _r IN SELECT * FROM public.shift_handoff_defaults(now()) LOOP
    _out := _out || format(E'\nDefault %s: %s (%s) %s', _r.team,
      CASE _r.user_id WHEN _b THEN 'evening coordinator B' WHEN _sup THEN 'Supervisor' WHEN _a THEN 'A ITSELF' ELSE coalesce(_r.user_id::text, 'nobody') END, _r.role_code, _r.note);
  END LOOP;

  -- End my shift with two tickets to B.
  _items := jsonb_build_array(
    jsonb_build_object('ticket_id', _t1, 'to_user', _b, 'done', 'Plumber called', 'next_step', 'Confirm arrival', 'due_at', now() + interval '1 hour'),
    jsonb_build_object('ticket_id', _t2, 'to_user', _b, 'done', 'Router restarted', 'next_step', 'Call guest back', 'due_at', now() + interval '2 hours'));
  _res := public.end_my_shift('end_of_shift', now(), _items, false, false);
  RESET ROLE;
  SELECT count(*) INTO _n FROM public.handoffs WHERE ticket_id IN (_t1, _t2) AND status = 'pending' AND to_user = _b AND from_user = _a AND handoff_type = 'shift_coverage';
  _out := _out || format(E'\nEnd my shift: result=%s pending handoffs to B=%s', _res, _n);
  SELECT count(*) FILTER (WHERE current_action_owner = _a AND handoff_status = 'pending' AND pending_handoff_to = _b) INTO _n FROM public.tickets WHERE id IN (_t1, _t2);
  _out := _out || format(E'\nBefore Accept: A still owns both=%s', _n = 2);
  SELECT count(*) INTO _n FROM public.ticket_activity WHERE ticket_id IN (_t1, _t2) AND event_type = 'handoff_requested' AND author_id = _a;
  SELECT body INTO _err FROM public.ticket_activity WHERE ticket_id = _t1 AND event_type = 'handoff_requested';
  _out := _out || format(E'\nHistory lines=%s; line: %s', _n, _err);
  SELECT count(*) INTO _n FROM public.shift_end_records WHERE user_id = _a AND kind = 'end_of_shift' AND NOT nothing_to_hand_off AND array_length(handoff_ids, 1) = 2;
  _out := _out || format(E'\nShift records=%s', _n);
  SELECT count(*) INTO _n FROM public.staff_notifications WHERE user_id = _b AND kind = 'handoff_pending' AND entity_id IN (SELECT id FROM public.handoffs WHERE ticket_id IN (_t1, _t2));
  _out := _out || format(E'\nReceiver told at once (existing alert)=%s', _n);

  -- B accepts the first one exactly as the ticket's Accept button does.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.tickets SET handoff_status = 'accepted', pending_handoff_to = NULL, current_action_owner = _b, assignment_source = 'manual', assignment_note = NULL WHERE id = _t1;
  UPDATE public.handoffs SET status = 'accepted', responded_at = now(), accepted_by = _b, accepted_at = now() WHERE ticket_id = _t1 AND status = 'pending';
  RESET ROLE;
  SELECT (SELECT current_action_owner FROM public.tickets WHERE id = _t1) = _b, (SELECT current_action_owner FROM public.tickets WHERE id = _t2) = _a INTO _r;
  _out := _out || format(E'\nAfter Accept of one: accepted moved to B=%s, other still with A=%s', _r.f1, _r.f2);

  -- The 15 minute alert: the unaccepted Right now handoff is the first ticket's? No: it was accepted.
  -- Make the second (Today) one Right now to test, and move its ask back 16 minutes.
  UPDATE public.handoffs SET priority = 'p1', created_at = now() - interval '16 minutes' WHERE ticket_id = _t2 AND status = 'pending';
  PERFORM public.run_ticket_timed_alerts();
  PERFORM public.run_ticket_timed_alerts();
  SELECT count(*) FILTER (WHERE kind = 'handoff_receiver' AND recipient = _b), count(*) FILTER (WHERE kind = 'handoff_supervisor' AND recipient = _sup) INTO _n, _n2
    FROM public.ticket_timed_alerts WHERE ticket_id = _t2;
  _out := _out || format(E'\n15 minute alert after two runs: receiver=%s supervisor=%s', _n, _n2);
  SELECT count(*) FILTER (WHERE user_id = _b AND kind = 'handoff_unaccepted'), count(*) FILTER (WHERE user_id = _sup AND kind = 'handoff_unaccepted_supervisor'),
         bool_and(email_status = 'pending')
    INTO _r FROM public.staff_notifications WHERE entity_id IN (SELECT id FROM public.handoffs WHERE ticket_id = _t2) AND kind LIKE 'handoff_unaccepted%';
  _out := _out || format(E'\nIn app: receiver=%s supervisor=%s email queued=%s', _r.count, _r.count_1, _r.bool_and);
  -- A fresh one (under 15 minutes) is not alerted.
  SELECT count(*) INTO _n FROM public.ticket_timed_alerts WHERE ticket_id = _t1;
  _out := _out || format(E'\nAccepted ticket alerts=%s', _n);

  -- A role handoff: the evening coordinator role resolves to the person on shift (B);
  -- the weekday day role has nobody on shift now and goes to the Supervisor.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  _res := public.end_my_shift('lunch', now(), jsonb_build_array(
    jsonb_build_object('ticket_id', _t3, 'to_role', 'po_evening', 'done', 'Code sent', 'next_step', 'Check gate', 'due_at', now() + interval '1 hour')), false, false);
  RESET ROLE;
  SELECT to_user = _b, to_role_code INTO _r FROM public.handoffs WHERE ticket_id = _t3;
  _out := _out || format(E'\nRole po_evening went to B=%s (%s)', _r.f1, _r.f2);
  UPDATE public.tickets SET handoff_status = 'rejected', pending_handoff_to = NULL WHERE id = _t3;
  UPDATE public.handoffs SET status = 'rejected', responded_at = now(), response_reason = 'practice' WHERE ticket_id = _t3;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  _res := public.end_my_shift('end_of_shift', now(), jsonb_build_array(
    jsonb_build_object('ticket_id', _t3, 'to_role', 'po_day', 'done', 'Code sent', 'next_step', 'Check gate', 'due_at', now() + interval '1 hour')), false, false);
  RESET ROLE;
  SELECT to_user = _sup, to_role_code INTO _r FROM public.handoffs WHERE ticket_id = _t3 AND status = 'pending';
  _out := _out || format(E'\nRole po_day (nobody on shift) went to the Supervisor=%s (%s)', _r.f1, _r.f2);

  -- Refusals: someone who does not own it, and an empty list without Nothing to hand off.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.end_my_shift('end_of_shift', now(), jsonb_build_array(jsonb_build_object('ticket_id', _t2, 'to_user', _sup, 'done', 'x', 'next_step', 'y', 'due_at', now())), false, false);
    _out := _out || E'\nNot owner: NOT refused';
  EXCEPTION WHEN others THEN _out := _out || format(E'\nNot owner refused: %s', SQLERRM); END;
  BEGIN
    PERFORM public.end_my_shift('end_of_shift', now(), '[]'::jsonb, false, false);
    _out := _out || E'\nEmpty list: NOT refused';
  EXCEPTION WHEN others THEN _out := _out || format(E'\nEmpty list refused: %s', SQLERRM); END;
  -- Nothing to hand off.
  _res := public.end_my_shift('end_of_shift', now(), '[]'::jsonb, true, false);
  RESET ROLE;
  SELECT count(*) INTO _n FROM public.shift_end_records WHERE user_id = _b AND nothing_to_hand_off AND handoff_ids = '{}';
  _out := _out || format(E'\nNothing to hand off record=%s', _n);

  -- Time off: refused before Nov 16, then (start moved to today in this cancelled step) sent to the Supervisor.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.request_time_off(current_date + 10, current_date + 11, 'practice', false);
    _out := _out || E'\nBefore Nov 16: NOT refused';
  EXCEPTION WHEN others THEN _out := _out || format(E'\nBefore Nov 16 refused: %s', SQLERRM); END;
  RESET ROLE;
  INSERT INTO public.app_settings(key, value) VALUES ('time_off_requests_start', to_jsonb((now() AT TIME ZONE 'America/Chicago')::date::text))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  SET LOCAL ROLE authenticated;
  _req := public.request_time_off(current_date + 10, current_date + 11, 'practice', false);
  RESET ROLE;
  SELECT count(*) INTO _n FROM public.staff_notifications WHERE user_id = _sup AND kind = 'time_off_request' AND entity_id = _req;
  _out := _out || format(E'\nTime off request sent to the Supervisor=%s', _n);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.decide_time_off(_req, 'approved', '');
    _out := _out || E'\nCoordinator deciding: NOT refused';
  EXCEPTION WHEN others THEN _out := _out || format(E'\nCoordinator deciding refused: %s', SQLERRM); END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _sup, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.decide_time_off(_req, 'declined', '');
    _out := _out || E'\nDecline with no reason: NOT refused';
  EXCEPTION WHEN others THEN _out := _out || format(E'\nDecline with no reason refused: %s', SQLERRM); END;
  PERFORM public.decide_time_off(_req, 'approved', '');
  RESET ROLE;
  SELECT status, decided_by = _sup INTO _r FROM public.time_off_requests WHERE id = _req;
  SELECT count(*) INTO _n FROM public.staff_notifications WHERE user_id = _a AND kind = 'time_off_approved' AND entity_id = _req;
  _out := _out || format(E'\nSupervisor approved: status=%s by Supervisor=%s, person told=%s', _r.status, _r.f2, _n);

  RAISE EXCEPTION 'FINAL CHECK (rolled back): %', _out;
END;
$final$;
