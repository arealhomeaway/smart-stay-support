
-- ===== Practice checks (appended to 01_record_work.sql in practice_cancel.sql) =====
-- Real home 1012 Wasatch Ct; a real Property Coordinator (Property Operations day role).
-- Ends with a deliberate error so everything above, step 01 included, is rolled back.
DO $practice$
DECLARE
  _home uuid := 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03';
  _pc uuid := '1a4b8de5-0824-4066-8691-8e6bb912f964';
  _other uuid := '29380b2b-a59f-4de4-8588-7bcfebfc2d36';
  _wt uuid := (SELECT id FROM public.work_types WHERE name = 'Immediate maintenance');
  _out text := '';
  _t record;
  _r record;
  _tid uuid;
  _tid2 uuid;
  _n0 int; _a0 int; _n1 int; _a1 int;
  _e1 uuid; _e2 uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _pc, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT * INTO _r FROM public.record_work_route_preview(_wt);
  _out := _out || format(E'\npreview Immediate maintenance: %s %s', _r.who_kind, coalesce(_r.role_name, ''));
  SELECT * INTO _r FROM public.record_work_route_preview(NULL);
  _out := _out || format(E'\npreview no problem type: %s', _r.who_kind);

  -- Create ticket (as the app inserts it): The refrigerator is not cold. Repair Yes -> maintenance.
  INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind,
    maintenance_category, category, functional_role_code, guest_impact, occupancy_status, suggested_priority, priority,
    source_channel, reported_at, response_due_at, action_due_at, acknowledged_at, due_at, created_by, record_owner,
    accountable_owner, status)
  SELECT false, 'active_task', 'PRACTICE The refrigerator is not cold.', 'PRACTICE The refrigerator is not cold.',
    _home, wt.id, 'maintenance', 'appliance', wt.category, wt.functional_role_code, 'none', 'vacant', 'p2', 'p2',
    'guest_message', now(), now() + interval '30 minutes', now() + interval '60 minutes', now(), now() + interval '60 minutes',
    _pc, _pc, _pc, 'open'
  FROM public.work_types wt WHERE wt.id = _wt
  RETURNING id INTO _tid;
  RESET ROLE;
  SELECT t.ref, t.entry_kind, t.priority, t.assignment_source, t.assignment_note,
         (SELECT string_agg(fr.code, ',') FROM public.functional_roles fr WHERE fr.current_seat_holder = t.assigned_to) owner_roles
    INTO _t FROM public.tickets t WHERE t.id = _tid;
  _out := _out || format(E'\nticket: label=%s priority=%s owner_roles=%s source=%s note=%s',
    _t.entry_kind, _t.priority, coalesce(_t.owner_roles, 'none'), coalesce(_t.assignment_source, 'none'), _t.assignment_note);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _pc, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- Not sure yet: no problem type, Ops label.
  INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind, category,
    guest_impact, occupancy_status, suggested_priority, priority, source_channel, reported_at, response_due_at, action_due_at,
    acknowledged_at, due_at, created_by, record_owner, accountable_owner, status)
  VALUES (false, 'active_task', 'PRACTICE Something odd at the home.', 'PRACTICE Something odd at the home.',
    _home, NULL, 'ops', 'other', 'none', 'vacant', 'p3', 'p3', 'guest_message', now(),
    now() + interval '4 hours', now() + interval '8 hours', now(), now() + interval '8 hours', _pc, _pc, _pc, 'open')
  RETURNING id INTO _tid2;
  RESET ROLE;
  SELECT t.entry_kind, t.assignment_note,
         (SELECT string_agg(fr.code, ',') FROM public.functional_roles fr WHERE fr.current_seat_holder = t.assigned_to) owner_roles
    INTO _t FROM public.tickets t WHERE t.id = _tid2;
  _out := _out || format(E'\nnot sure ticket: label=%s owner_roles=%s note=%s', _t.entry_kind, coalesce(_t.owner_roles, 'none'), _t.assignment_note);

  -- One touch: home history only.
  SELECT count(*) INTO _n0 FROM public.tickets;
  SELECT count(*) INTO _a0 FROM public.staff_notifications;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _pc, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.property_activity_log (property_id, category, what_happened, outcome, logged_by, is_demo, problem_type_id, one_touch)
  VALUES (_home, 'property_condition', 'PRACTICE The refrigerator is not cold.', 'Nothing more to do.', _pc, false, _wt, true);
  RESET ROLE;
  SELECT count(*) INTO _n1 FROM public.tickets;
  SELECT count(*) INTO _a1 FROM public.staff_notifications;
  _out := _out || format(E'\none touch: new tickets=%s new alerts=%s', _n1 - _n0, _a1 - _a0);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _pc, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO _r FROM public.home_problem_repeat(_home, _wt);
  _out := _out || format(E'\nrepeat after 2: times=%s needed=%s days=%s flagged=%s', _r.times_in_window, _r.times_needed, _r.window_days, _r.flagged);
  INSERT INTO public.property_activity_log (property_id, category, what_happened, outcome, logged_by, is_demo, problem_type_id, one_touch)
  VALUES (_home, 'property_condition', 'PRACTICE The fridge is warm again.', 'Nothing more to do.', _pc, false, _wt, true);
  SELECT * INTO _r FROM public.home_problem_repeat(_home, _wt);
  _out := _out || format(E'\nrepeat after 3: times=%s flagged=%s', _r.times_in_window, _r.flagged);
  SELECT count(*) INTO _n0 FROM public.home_repeat_flags(_home, NULL);
  SELECT count(*) INTO _n1 FROM public.home_repeat_flags(NULL, now() - interval '7 days') f WHERE f.property_id = _home;
  _out := _out || format(E'\nflags on the home page=%s, on the weekly list=%s', _n0, _n1);

  -- Escalate now.
  _e1 := public.record_work_escalate(_tid);
  _e2 := public.record_work_escalate(_tid);
  RESET ROLE;
  SELECT t.escalation_level, (t.escalated_at IS NOT NULL) at_set,
    (SELECT count(*) FROM public.escalations e WHERE e.ticket_id = t.id AND e.status = 'open') open_esc,
    (SELECT count(*) FROM public.staff_notifications n WHERE n.entity_id = t.id AND n.kind = 'ticket_escalated') alerts,
    (SELECT bool_and(n.user_id = public.seat_holder_at('ops_supervisor', now())) FROM public.staff_notifications n
       WHERE n.entity_id = t.id AND n.kind = 'ticket_escalated') to_sup,
    (SELECT string_agg(DISTINCT n.email_status, ',') FROM public.staff_notifications n WHERE n.entity_id = t.id AND n.kind = 'ticket_escalated') email,
    (SELECT count(*) FROM public.ticket_activity a WHERE a.ticket_id = t.id AND a.event_type = 'escalated') lines
    INTO _t FROM public.tickets t WHERE t.id = _tid;
  _out := _out || format(E'\nescalate: same id twice=%s level=%s escalated_at=%s open=%s supervisor alerts=%s to Operations Supervisor=%s email=%s history lines=%s',
    _e1 = _e2, _t.escalation_level, _t.at_set, _t.open_esc, _t.alerts, _t.to_sup, _t.email, _t.lines);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _other, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.record_work_escalate(_tid);
    _out := _out || E'\nother person escalate: NOT REFUSED';
  EXCEPTION WHEN raise_exception THEN
    _out := _out || E'\nother person escalate: refused (' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'PRACTICE RESULT (rolled back): %', _out;
END;
$practice$;
