-- Record work as one flow (Emily, Nov 7, 2026; register T8, T9, T10, T11).
-- Additive only. Undo: 01_undo_record_work.sql. No BEGIN/COMMIT.
--
-- 1. One touch saves go to the home's history (property_activity_log) with the
--    problem type and a one touch mark. No ticket, no clocks, no alerts.
-- 2. Repeat rule settings: app_settings key record_work_repeat
--    ({"times": 3, "days": 90}); never hardcoded in a function.
-- 3. home_problem_repeat / home_repeat_flags: counts by problem type per home
--    across tickets and one touch saves. Quiet Notion imports and archived
--    tickets never count.
-- 4. record_work_route_preview: the routing by time result in plain words
--    (who will do it), read from the same ticket_route_at the ticket trigger uses.
--    Returns a role kind and role name only, never a person.
-- 5. record_work_escalate: marks a just-created ticket escalated (existing
--    escalations row and ticket fields) and alerts the Operations Supervisor
--    through the existing notify_staff path. Ownership is unchanged.

ALTER TABLE public.property_activity_log
  ADD COLUMN problem_type_id uuid REFERENCES public.work_types(id) ON DELETE SET NULL,
  ADD COLUMN one_touch boolean NOT NULL DEFAULT false;

CREATE INDEX property_activity_log_problem_repeat
  ON public.property_activity_log (property_id, problem_type_id, occurred_at)
  WHERE problem_type_id IS NOT NULL;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('record_work_repeat', '{"times": 3, "days": 90}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.record_work_repeat_settings(OUT times int, OUT days int)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    greatest(1, coalesce((s.value->>'times')::int, 3)),
    greatest(1, coalesce((s.value->>'days')::int, 90))
  FROM (SELECT 1) one
  LEFT JOIN public.app_settings s ON s.key = 'record_work_repeat';
$function$;
REVOKE ALL ON FUNCTION private.record_work_repeat_settings() FROM PUBLIC, anon, authenticated;

-- Every counted occurrence of a problem type at a home: ordinary tickets and
-- one touch saves. A Notion import counts only once someone reopened or took it.
CREATE OR REPLACE FUNCTION private.home_problem_events(_since timestamptz)
 RETURNS TABLE(property_id uuid, work_type_id uuid, at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.property_id, t.work_type_id, t.reported_at
  FROM public.tickets t
  WHERE t.property_id IS NOT NULL
    AND t.work_type_id IS NOT NULL
    AND t.archived_at IS NULL
    AND t.reported_at >= _since
    AND (coalesce(t.external_source, '') <> 'notion' OR t.external_status = 'reopened_in_resolve')
  UNION ALL
  SELECT a.property_id, a.problem_type_id, a.occurred_at
  FROM public.property_activity_log a
  WHERE a.problem_type_id IS NOT NULL
    AND a.occurred_at >= _since;
$function$;
REVOKE ALL ON FUNCTION private.home_problem_events(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.home_problem_repeat(_property_id uuid, _work_type_id uuid)
 RETURNS TABLE(times_in_window int, times_needed int, window_days int, flagged boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _s record;
  _n int;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can read home history.';
  END IF;
  SELECT * INTO _s FROM private.record_work_repeat_settings();
  SELECT count(*)::int INTO _n
  FROM private.home_problem_events(now() - make_interval(days => _s.days)) e
  WHERE e.property_id = _property_id AND e.work_type_id = _work_type_id;
  times_in_window := _n;
  times_needed := _s.times;
  window_days := _s.days;
  flagged := _n >= _s.times;
  RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.home_problem_repeat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_problem_repeat(uuid, uuid) TO authenticated;

-- Repeat flags: one home (property page) or every home whose latest repeat is
-- on or after _since (the Operations Supervisor's weekly list).
CREATE OR REPLACE FUNCTION public.home_repeat_flags(_property_id uuid DEFAULT NULL, _since timestamptz DEFAULT NULL)
 RETURNS TABLE(property_id uuid, work_type_id uuid, problem_type text, times int, last_at timestamptz, window_days int, is_demo boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _s record;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can read home history.';
  END IF;
  SELECT * INTO _s FROM private.record_work_repeat_settings();
  RETURN QUERY
  SELECT e.property_id, e.work_type_id, wt.name, count(*)::int, max(e.at), _s.days, p.is_demo
  FROM private.home_problem_events(now() - make_interval(days => _s.days)) e
  JOIN public.work_types wt ON wt.id = e.work_type_id
  JOIN public.properties p ON p.id = e.property_id
  WHERE (_property_id IS NULL OR e.property_id = _property_id)
  GROUP BY e.property_id, e.work_type_id, wt.name, p.is_demo
  HAVING count(*) >= _s.times AND max(e.at) >= coalesce(_since, '-infinity'::timestamptz)
  ORDER BY max(e.at) DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.home_repeat_flags(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_repeat_flags(uuid, timestamptz) TO authenticated;

-- Who will do it, in plain words: the same routing by time the ticket trigger
-- runs (auto_assign_ticket -> ticket_route_at), as a role, never a person.
CREATE OR REPLACE FUNCTION public.record_work_route_preview(_work_type_id uuid)
 RETURNS TABLE(who_kind text, role_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can record work.';
  END IF;
  SELECT * INTO r FROM public.ticket_route_at(
    (SELECT wt.functional_role_code FROM public.work_types wt WHERE wt.id = _work_type_id),
    _work_type_id, now());
  IF r.user_id IS NULL THEN
    who_kind := 'nobody';
  ELSIF r.role_code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening') THEN
    who_kind := 'coordinator';
  ELSIF r.role_code IS NULL THEN
    who_kind := 'on_call';
  ELSIF r.role_code = 'ops_supervisor' THEN
    who_kind := 'supervisor';
  ELSE
    who_kind := 'role';
    SELECT fr.name INTO role_name FROM public.functional_roles fr WHERE fr.code = r.role_code;
  END IF;
  RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_work_route_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_work_route_preview(uuid) TO authenticated;

-- Escalate now (insurance risk): the person who just created the ticket marks it
-- escalated and the Operations Supervisor is told. Pressing it twice is safe.
CREATE OR REPLACE FUNCTION public.record_work_escalate(_ticket_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _t record;
  _id uuid;
  _supervisor uuid;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can escalate a ticket.';
  END IF;
  SELECT id, ref, title, property_id, is_demo, created_by, archived_at
    INTO _t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND OR _t.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'That ticket could not be found.';
  END IF;
  IF _t.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who recorded this ticket can escalate it here.';
  END IF;

  SELECT e.id INTO _id FROM public.escalations e
  WHERE e.ticket_id = _ticket_id AND e.status = 'open'
  ORDER BY e.created_at DESC LIMIT 1;
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  INSERT INTO public.escalations (
    ticket_id, property_id, escalated_by, escalated_to_role, reason, help_needed, urgency, is_demo
  ) VALUES (
    _ticket_id, _t.property_id, auth.uid(), 'supervisor',
    'This could be an insurance claim. Escalated before taking action.',
    'Decide what happens next. The team waits for your answer before acting.',
    'critical', _t.is_demo
  ) RETURNING id INTO _id;

  UPDATE public.tickets
  SET escalation_level = CASE WHEN escalation_level = 'none' THEN 'supervisor' ELSE escalation_level END,
      escalated_at = coalesce(escalated_at, now())
  WHERE id = _ticket_id;

  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, internal, body)
  VALUES (_ticket_id, auth.uid(), 'status', 'escalated', false,
    'Escalated to the Operations Supervisor: this could be an insurance claim. Ownership is unchanged.');

  _supervisor := public.seat_holder_at('ops_supervisor', now());
  PERFORM public.notify_staff(
    _supervisor, 'ticket_escalated',
    'Escalated: #' || _t.ref::text || ' ' || _t.title,
    'This could be an insurance claim. The team is waiting for your answer before acting.',
    'ticket', _ticket_id, '/tickets/' || _ticket_id::text, 'high', auth.uid(), true, _t.is_demo
  );

  RETURN _id;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_work_escalate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_work_escalate(uuid) TO authenticated;

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
