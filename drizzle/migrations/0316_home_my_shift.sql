-- Home: My shift, End my shift, the 15 minute handoff alert, the lunch handoff
-- and Request time off (Emily, Nov 7, confirmed Nov 9; register T1, T2, T4, T6, S1, S4).
-- Undo: 01_undo_home_my_shift.sql. Additive: two new tables, five new functions,
-- two new alert kinds and one new part (c) in run_ticket_timed_alerts; parts a and b
-- are byte-identical to live-capture/public.run_ticket_timed_alerts.sql.
-- Unchanged: handoffs, the handoff panel, notify_handoff_events, routing
-- (coordinator_for, ticket_route_at, auto_assign_ticket), the schedule, on call,
-- coverage overrides, clocks and every scheduled job (ticket-timed-alerts keeps
-- running every minute and simply finds part c).

-- 1. One record each time someone ends a shift or hands off before lunch.
CREATE TABLE public.shift_end_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'end_of_shift' CHECK (kind IN ('end_of_shift', 'lunch')),
  ended_at timestamptz NOT NULL DEFAULT now(),
  nothing_to_hand_off boolean NOT NULL DEFAULT false,
  ticket_ids uuid[] NOT NULL DEFAULT '{}',
  handoff_ids uuid[] NOT NULL DEFAULT '{}',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shift_end_records TO authenticated;
GRANT ALL ON public.shift_end_records TO service_role;
ALTER TABLE public.shift_end_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own shift records and leadership read" ON public.shift_end_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_supervisor(auth.uid()));
CREATE INDEX shift_end_records_user_idx ON public.shift_end_records (user_id, ended_at DESC);

-- 2. Time off requests (register S4). Written only through the two functions below.
CREATE TABLE public.time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  CHECK (note IS NULL OR length(note) <= 400),
  CHECK (decision_note IS NULL OR length(decision_note) <= 400)
);
GRANT SELECT ON public.time_off_requests TO authenticated;
GRANT ALL ON public.time_off_requests TO service_role;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own time off requests and leadership read" ON public.time_off_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_supervisor(auth.uid()));
CREATE INDEX time_off_requests_status_idx ON public.time_off_requests (status, created_at);

-- 3. Two new alert kinds for the 15 minute handoff alert.
ALTER TABLE public.ticket_timed_alerts DROP CONSTRAINT ticket_timed_alerts_kind_check;
ALTER TABLE public.ticket_timed_alerts ADD CONSTRAINT ticket_timed_alerts_kind_check
  CHECK (kind = ANY (ARRAY['team_queue_supervisor'::text, 'team_queue_director'::text, 'waiting_return'::text,
                           'handoff_receiver'::text, 'handoff_supervisor'::text]));

-- 4. Who gets the work by default: the routing function at the handoff time.
--    A result that is the person handing off falls back to the Operations Supervisor.
CREATE OR REPLACE FUNCTION public.shift_handoff_defaults(_at timestamptz DEFAULT now())
RETURNS TABLE(team text, user_id uuid, role_code text, note text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
  v_at timestamptz := greatest(now(), least(coalesce(_at, now()), now() + interval '16 hours'));
  v_sup uuid := public.seat_holder_at('ops_supervisor', greatest(now(), least(coalesce(_at, now()), now() + interval '16 hours')));
  v_team text;
  c record;
BEGIN
  IF v_me IS NULL OR NOT private.is_staff(v_me) THEN
    RAISE EXCEPTION 'Only the team can hand off work.';
  END IF;
  FOREACH v_team IN ARRAY ARRAY['guest_experience', 'property_operations'] LOOP
    SELECT * INTO c FROM public.coordinator_for(v_team, v_at);
    IF c.user_id IS NOT NULL AND c.user_id <> v_me THEN
      team := v_team; user_id := c.user_id; role_code := c.role_code; note := c.note;
    ELSIF v_sup IS NOT NULL AND v_sup <> v_me THEN
      team := v_team; user_id := v_sup; role_code := 'ops_supervisor';
      note := 'Nobody else is on shift, so it goes to the Operations Supervisor.';
    ELSE
      team := v_team; user_id := NULL; role_code := NULL;
      note := 'Nobody else is on shift. Choose who gets it.';
    END IF;
    RETURN NEXT;
  END LOOP;
  team := 'supervisor';
  user_id := CASE WHEN v_sup IS DISTINCT FROM v_me THEN v_sup END;
  role_code := 'ops_supervisor';
  note := NULL;
  RETURN NEXT;
END
$function$;
REVOKE ALL ON FUNCTION public.shift_handoff_defaults(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_handoff_defaults(timestamptz) TO authenticated, service_role;

-- 5. End my shift (or hand off before lunch): one handoff per ticket through the
--    existing handoff records, one history line per ticket and one shift record,
--    all in one transaction. Ownership moves only when the receiver accepts.
CREATE OR REPLACE FUNCTION public.end_my_shift(
  _kind text,
  _at timestamptz,
  _items jsonb,
  _nothing boolean,
  _demo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_at timestamptz := greatest(now(), least(coalesce(_at, now()), now() + interval '16 hours'));
  v_kind text := coalesce(_kind, 'end_of_shift');
  v_items jsonb := coalesce(_items, '[]'::jsonb);
  v_item jsonb;
  v_t public.tickets%ROWTYPE;
  v_ticket uuid;
  v_ref text;
  v_to uuid;
  v_role text;
  v_to_role text;
  v_team text;
  v_my_team text;
  v_done text;
  v_next text;
  v_due timestamptz;
  v_label text;
  v_handoff uuid;
  v_record uuid;
  v_ticket_ids uuid[] := '{}';
  v_handoff_ids uuid[] := '{}';
  v_pick record;
  v_coord text[] := ARRAY['ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening'];
BEGIN
  IF v_me IS NULL OR NOT private.is_staff(v_me) THEN
    RAISE EXCEPTION 'Only the team can hand off work.';
  END IF;
  IF v_kind NOT IN ('end_of_shift', 'lunch') THEN
    RAISE EXCEPTION 'Unknown handoff.';
  END IF;
  IF jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'The list of tickets could not be read.';
  END IF;
  IF coalesce(_nothing, false) AND jsonb_array_length(v_items) > 0 THEN
    RAISE EXCEPTION 'Untick Nothing to hand off, or remove the tickets.';
  END IF;
  IF NOT coalesce(_nothing, false) AND jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Choose who gets each ticket, or tick Nothing to hand off.';
  END IF;

  SELECT CASE WHEN fr.code LIKE 'ge\_%' THEN 'guest_experience' ELSE 'property_operations' END
    INTO v_my_team
    FROM public.functional_roles fr
   WHERE fr.active AND fr.code = ANY (v_coord) AND public.seat_holder_at(fr.code, now()) = v_me
   ORDER BY fr.sort_order
   LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_ticket := nullif(v_item->>'ticket_id', '')::uuid;
    IF v_ticket IS NULL THEN
      RAISE EXCEPTION 'A ticket is missing from the list.';
    END IF;
    IF v_ticket = ANY (v_ticket_ids) THEN
      RAISE EXCEPTION 'A ticket is in the list twice.';
    END IF;

    SELECT * INTO v_t FROM public.tickets WHERE id = v_ticket FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A ticket in the list could not be found.';
    END IF;
    v_ref := coalesce('#' || v_t.ref::text, 'this ticket');
    IF v_t.archived_at IS NOT NULL OR v_t.status IN ('resolved', 'closed') THEN
      RAISE EXCEPTION 'Ticket % is no longer open. Refresh and try again.', v_ref;
    END IF;
    IF coalesce(v_t.is_demo, false) <> coalesce(_demo, false) THEN
      RAISE EXCEPTION 'Ticket % does not belong to this view.', v_ref;
    END IF;
    IF coalesce(v_t.current_action_owner, v_t.assigned_to, v_t.record_owner, v_t.accountable_owner) IS DISTINCT FROM v_me THEN
      RAISE EXCEPTION 'You no longer own ticket %. Refresh and try again.', v_ref;
    END IF;
    IF v_t.handoff_status = 'pending' THEN
      RAISE EXCEPTION 'Ticket % is already waiting for someone to accept it.', v_ref;
    END IF;
    IF coalesce(v_t.external_source, '') = 'notion' AND v_t.external_status IS DISTINCT FROM 'reopened_in_resolve' THEN
      RAISE EXCEPTION 'Ticket % is an imported ticket nobody has taken yet.', v_ref;
    END IF;

    v_done := btrim(coalesce(v_item->>'done', ''));
    v_next := btrim(coalesce(v_item->>'next_step', ''));
    v_due := nullif(v_item->>'due_at', '')::timestamptz;
    IF v_done = '' THEN RAISE EXCEPTION 'Write what is done so far on ticket %.', v_ref; END IF;
    IF v_next = '' THEN RAISE EXCEPTION 'Write the next step on ticket %.', v_ref; END IF;
    IF v_due IS NULL THEN RAISE EXCEPTION 'Choose when the next step on ticket % is due.', v_ref; END IF;
    IF length(v_done) > 2000 OR length(v_next) > 500 THEN
      RAISE EXCEPTION 'The note on ticket % is too long.', v_ref;
    END IF;

    v_team := CASE
      WHEN v_t.functional_role_code LIKE 'ge\_%' THEN 'guest_experience'
      WHEN v_t.functional_role_code LIKE 'po\_%' THEN 'property_operations'
      ELSE v_my_team END;

    -- Who gets it: a person, or a role that resolves to the person on shift in it.
    v_to := nullif(v_item->>'to_user', '')::uuid;
    v_role := nullif(v_item->>'to_role', '');
    v_to_role := NULL;
    IF v_to IS NULL AND v_role IS NOT NULL THEN
      IF v_role = 'coordinator' THEN
        IF v_team IS NOT NULL THEN
          SELECT * INTO v_pick FROM public.coordinator_for(v_team, v_at);
          IF v_pick.user_id IS NOT NULL AND v_pick.user_id <> v_me THEN
            v_to := v_pick.user_id; v_to_role := v_pick.role_code;
          END IF;
        END IF;
      ELSIF v_role = 'ops_supervisor' THEN
        v_to := public.seat_holder_at('ops_supervisor', v_at); v_to_role := 'ops_supervisor';
      ELSIF v_role = ANY (v_coord) THEN
        IF public.seat_eligible_now(v_role, v_at) AND public.staff_assignable(public.seat_holder_at(v_role, v_at))
           AND public.seat_holder_at(v_role, v_at) <> v_me THEN
          v_to := public.seat_holder_at(v_role, v_at); v_to_role := v_role;
        END IF;
      ELSE
        RAISE EXCEPTION 'Unknown role on ticket %.', v_ref;
      END IF;
      -- A role with nobody on shift goes to the Operations Supervisor (register T6).
      IF v_to IS NULL OR v_to = v_me THEN
        v_to := public.seat_holder_at('ops_supervisor', v_at); v_to_role := 'ops_supervisor';
      END IF;
    END IF;
    IF v_to IS NULL THEN
      RAISE EXCEPTION 'Choose who gets ticket %.', v_ref;
    END IF;
    IF v_to = v_me THEN
      RAISE EXCEPTION 'Choose someone else for ticket %.', v_ref;
    END IF;
    IF NOT private.is_staff(v_to) THEN
      RAISE EXCEPTION 'The person chosen for ticket % is not on the team.', v_ref;
    END IF;
    IF v_to_role IS NULL THEN
      SELECT fr.code INTO v_to_role FROM public.functional_roles fr
       WHERE fr.active AND fr.current_seat_holder = v_to ORDER BY fr.sort_order LIMIT 1;
      v_to_role := coalesce(v_to_role, v_t.functional_role_code);
    END IF;
    v_label := CASE
      WHEN v_to_role = ANY (v_coord) THEN 'the ' || public.coordinator_role_label(v_to_role)
      WHEN v_to_role = 'ops_supervisor' THEN 'the Operations Supervisor'
      ELSE 'a teammate' END;

    INSERT INTO public.handoffs(
      ticket_id, from_user, to_user, to_role_code, handoff_type, summary, priority,
      actions_completed, current_status, next_action, due_at, guest_comm_status, is_demo)
    VALUES (
      v_t.id, v_me, v_to, v_to_role, 'shift_coverage', coalesce(v_t.title, 'Ticket'), v_t.priority,
      v_done,
      CASE WHEN v_kind = 'lunch' THEN 'Handed off before lunch' ELSE 'Handed off at the end of a shift' END,
      v_next, v_due, 'not_required', coalesce(v_t.is_demo, false))
    RETURNING id INTO v_handoff;

    UPDATE public.tickets
       SET handoff_status = 'pending',
           pending_handoff_to = v_to,
           handoff_type = 'shift_coverage',
           handoff_note = coalesce(v_t.title, 'Ticket'),
           next_action = v_next
     WHERE id = v_t.id;

    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, from_owner, to_owner, is_demo)
    VALUES (
      v_t.id, v_me, 'handoff', 'handoff_requested',
      CASE WHEN v_kind = 'lunch' THEN 'Before lunch: handed to ' ELSE 'End of shift: handed to ' END
        || v_label || ' to accept. Done so far: ' || v_done || ' Next step: ' || v_next || ', due '
        || to_char(v_due AT TIME ZONE 'America/Chicago', 'Mon FMDD, FMHH12:MI AM')
        || '. It moves only when accepted; until then the sender still owns it.',
      v_me, v_to, coalesce(v_t.is_demo, false));

    v_ticket_ids := v_ticket_ids || v_t.id;
    v_handoff_ids := v_handoff_ids || v_handoff;
  END LOOP;

  INSERT INTO public.shift_end_records(user_id, kind, nothing_to_hand_off, ticket_ids, handoff_ids, is_demo)
  VALUES (v_me, v_kind, coalesce(_nothing, false), v_ticket_ids, v_handoff_ids, coalesce(_demo, false))
  RETURNING id INTO v_record;

  RETURN jsonb_build_object('record_id', v_record, 'handoffs', coalesce(array_length(v_handoff_ids, 1), 0));
END
$function$;
REVOKE ALL ON FUNCTION public.end_my_shift(text, timestamptz, jsonb, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_my_shift(text, timestamptz, jsonb, boolean, boolean) TO authenticated, service_role;

-- 6. Request time off: from the start date in app_settings time_off_requests_start
--    (default Nov 16, 2026); it goes to the Operations Supervisor.
CREATE OR REPLACE FUNCTION public.request_time_off(_starts date, _ends date, _note text, _demo boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_open date := '2026-11-16';
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_id uuid;
  v_sup uuid;
  v_note text := nullif(btrim(coalesce(_note, '')), '');
BEGIN
  IF v_me IS NULL OR NOT private.is_staff(v_me) THEN
    RAISE EXCEPTION 'Only the team can request time off.';
  END IF;
  BEGIN
    v_open := coalesce((SELECT (value #>> '{}')::date FROM public.app_settings WHERE key = 'time_off_requests_start'), v_open);
  EXCEPTION WHEN others THEN
    v_open := '2026-11-16';
  END;
  IF v_today < v_open THEN
    RAISE EXCEPTION 'Time off requests start %.', trim(to_char(v_open, 'Mon FMDD'));
  END IF;
  IF _starts IS NULL OR _ends IS NULL THEN
    RAISE EXCEPTION 'Choose the first and last day off.';
  END IF;
  IF _ends < _starts THEN
    RAISE EXCEPTION 'The last day off must be on or after the first.';
  END IF;
  IF _starts < v_today THEN
    RAISE EXCEPTION 'Choose a day from today on.';
  END IF;
  IF _ends - _starts > 60 THEN
    RAISE EXCEPTION 'Ask for at most 60 days at a time.';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 400 THEN
    RAISE EXCEPTION 'Keep the note under 400 characters.';
  END IF;

  INSERT INTO public.time_off_requests(user_id, starts_on, ends_on, note, is_demo)
  VALUES (v_me, _starts, _ends, v_note, coalesce(_demo, false))
  RETURNING id INTO v_id;

  v_sup := public.seat_holder_at('ops_supervisor', now());
  PERFORM public.notify_staff(
    v_sup, 'time_off_request', 'Time off request',
    trim(to_char(_starts, 'Mon FMDD')) || CASE WHEN _ends > _starts THEN ' to ' || trim(to_char(_ends, 'Mon FMDD')) ELSE '' END
      || '. Approve it and choose who covers, or decline it with a reason.',
    'time_off_request', v_id, '/dashboard', 'normal', v_me, true, coalesce(_demo, false));
  RETURN v_id;
END
$function$;
REVOKE ALL ON FUNCTION public.request_time_off(date, date, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_time_off(date, date, text, boolean) TO authenticated, service_role;

-- 7. The Supervisor approves (after entering the time off and cover with the
--    existing tools) or declines with a reason. The person is told either way.
CREATE OR REPLACE FUNCTION public.decide_time_off(_id uuid, _decision text, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_r public.time_off_requests%ROWTYPE;
  v_note text := nullif(btrim(coalesce(_note, '')), '');
BEGIN
  IF v_me IS NULL OR NOT public.is_supervisor(v_me) THEN
    RAISE EXCEPTION 'Only Operations leadership can decide time off.';
  END IF;
  IF _decision NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Approve or decline.';
  END IF;
  SELECT * INTO v_r FROM public.time_off_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This request could not be found.';
  END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'This request was already decided.';
  END IF;
  IF _decision = 'declined' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Write why it is declined.';
  END IF;
  UPDATE public.time_off_requests
     SET status = _decision, decided_by = v_me, decided_at = now(), decision_note = v_note
   WHERE id = _id;
  PERFORM public.notify_staff(
    v_r.user_id, 'time_off_' || _decision,
    CASE WHEN _decision = 'approved' THEN 'Time off approved' ELSE 'Time off declined' END,
    trim(to_char(v_r.starts_on, 'Mon FMDD')) || CASE WHEN v_r.ends_on > v_r.starts_on THEN ' to ' || trim(to_char(v_r.ends_on, 'Mon FMDD')) ELSE '' END
      || CASE WHEN v_note IS NOT NULL THEN '. ' || v_note ELSE '.' END,
    'time_off_request', _id, '/dashboard', 'normal', v_me, true, v_r.is_demo);
END
$function$;
REVOKE ALL ON FUNCTION public.decide_time_off(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_time_off(uuid, text, text) TO authenticated, service_role;

-- 8. The every minute check: parts a and b exactly as live; new part c alerts an
--    unaccepted Right now handoff to the receiver and the Operations Supervisor
--    once, 15 minutes after it was asked (team_queue_timing handoff_minutes).
CREATE OR REPLACE FUNCTION public.run_ticket_timed_alerts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cfg jsonb := coalesce((SELECT value FROM public.app_settings WHERE key = 'team_queue_timing'), '{}'::jsonb);
  _sup_min int := 10;
  _dir_min int := 15;
  _handoff_min int := 15;
  _t record;
  _to uuid;
  _log uuid;
  _ref text;
  _sent integer := 0;
BEGIN
  BEGIN
    _sup_min := coalesce(nullif(_cfg->>'supervisor_minutes', '')::int, 10);
    _dir_min := coalesce(nullif(_cfg->>'director_minutes', '')::int, 15);
  EXCEPTION WHEN others THEN
    _sup_min := 10; _dir_min := 15;
  END;
  BEGIN
    _handoff_min := coalesce(nullif(_cfg->>'handoff_minutes', '')::int, 15);
  EXCEPTION WHEN others THEN
    _handoff_min := 15;
  END;

  -- a. Right now tickets nobody has taken.
  FOR _t IN
    SELECT id, ref, title, unowned_since
      FROM public.tickets
     WHERE priority = 'p1'
       AND assigned_to IS NULL
       AND archived_at IS NULL
       AND unowned_since IS NOT NULL
       AND NOT coalesce(is_demo, false)
       AND status IN ('open','dispatched','in_progress','awaiting_guest')
       AND NOT (coalesce(external_source, '') = 'notion' AND external_status IS DISTINCT FROM 'reopened_in_resolve')
       AND unowned_since <= now() - make_interval(mins => _sup_min)
  LOOP
    _ref := coalesce('#' || _t.ref::text || ' ', '');

    _to := public.seat_holder_at('ops_supervisor', now());
    IF _to IS NOT NULL THEN
      _log := NULL;
      INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
      VALUES (_t.id, 'team_queue_supervisor', _t.unowned_since, _to)
      ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
      RETURNING id INTO _log;
      IF _log IS NOT NULL THEN
        UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
          _to, 'team_queue_supervisor',
          'Nobody has taken this: ' || _ref || coalesce(_t.title, 'Ticket'),
          'A Right now ticket has waited ' || _sup_min || ' minutes in the Team Queue with no owner. Give it to someone on shift or take it.',
          'ticket', _t.id, '/tickets/' || _t.id::text, 'urgent', NULL, true, false)
        WHERE id = _log;
        _sent := _sent + 1;
      END IF;
    END IF;

    IF _t.unowned_since <= now() - make_interval(mins => _dir_min) THEN
      _to := public.seat_holder_at('director_ops', now());
      IF _to IS NOT NULL THEN
        _log := NULL;
        INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
        VALUES (_t.id, 'team_queue_director', _t.unowned_since, _to)
        ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
        RETURNING id INTO _log;
        IF _log IS NOT NULL THEN
          UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
            _to, 'team_queue_director',
            'Still nobody on it: ' || _ref || coalesce(_t.title, 'Ticket'),
            'A Right now ticket has waited ' || _dir_min || ' minutes in the Team Queue with no owner. The Operations Supervisor was alerted at ' || _sup_min || ' minutes.',
            'ticket', _t.id, '/tickets/' || _t.id::text, 'urgent', NULL, true, false)
          WHERE id = _log;
          _sent := _sent + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- b. Waiting tickets whose return time has come.
  FOR _t IN
    SELECT id, ref, title, next_review_at, coalesce(assigned_to, current_action_owner) AS owner, coalesce(is_demo, false) AS is_demo
      FROM public.tickets
     WHERE status = 'waiting'
       AND archived_at IS NULL
       AND next_review_at IS NOT NULL
       AND next_review_at <= now()
       AND coalesce(assigned_to, current_action_owner) IS NOT NULL
       AND NOT (coalesce(external_source, '') = 'notion' AND external_status IS DISTINCT FROM 'reopened_in_resolve')
  LOOP
    _log := NULL;
    INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
    VALUES (_t.id, 'waiting_return', _t.next_review_at, _t.owner)
    ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
    RETURNING id INTO _log;
    IF _log IS NOT NULL THEN
      UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
        _t.owner, 'waiting_returned',
        'Back from waiting: ' || coalesce('#' || _t.ref::text || ' ', '') || coalesce(_t.title, 'Ticket'),
        'The return time you set has come. Pick it up again.',
        'ticket', _t.id, '/tickets/' || _t.id::text, 'normal', NULL, true, _t.is_demo)
      WHERE id = _log;
      _sent := _sent + 1;
    END IF;
  END LOOP;

  -- c. Right now handoffs nobody has accepted (register T6): the receiver and the
  --    Operations Supervisor, once each, after _handoff_min minutes. A handoff to a
  --    role with no person still reaches the Supervisor.
  FOR _t IN
    SELECT h.id AS handoff_id, h.ticket_id, h.to_user, h.created_at, t.ref, t.title,
           coalesce(h.is_demo, false) AS is_demo
      FROM public.handoffs h
      JOIN public.tickets t ON t.id = h.ticket_id
     WHERE h.status = 'pending'
       AND h.priority = 'p1'
       AND h.created_at <= now() - make_interval(mins => _handoff_min)
       AND t.archived_at IS NULL
       AND t.status NOT IN ('resolved', 'closed')
  LOOP
    _ref := coalesce('#' || _t.ref::text || ' ', '');

    IF _t.to_user IS NOT NULL THEN
      _log := NULL;
      INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
      VALUES (_t.ticket_id, 'handoff_receiver', _t.created_at, _t.to_user)
      ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
      RETURNING id INTO _log;
      IF _log IS NOT NULL THEN
        UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
          _t.to_user, 'handoff_unaccepted',
          'Still waiting for you: ' || _ref || coalesce(_t.title, 'Ticket'),
          'A Right now handoff has waited ' || _handoff_min || ' minutes. Accept it or decline it with a reason now.',
          'handoff', _t.handoff_id, '/tickets/' || _t.ticket_id::text, 'urgent', NULL, true, _t.is_demo)
        WHERE id = _log;
        _sent := _sent + 1;
      END IF;
    END IF;

    _to := public.seat_holder_at('ops_supervisor', now());
    IF _to IS NOT NULL AND _to IS DISTINCT FROM _t.to_user THEN
      _log := NULL;
      INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
      VALUES (_t.ticket_id, 'handoff_supervisor', _t.created_at, _to)
      ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
      RETURNING id INTO _log;
      IF _log IS NOT NULL THEN
        UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
          _to, 'handoff_unaccepted_supervisor',
          'Handoff not accepted: ' || _ref || coalesce(_t.title, 'Ticket'),
          'A Right now handoff has waited ' || _handoff_min || ' minutes and nobody has accepted it. Make sure someone has it.',
          'handoff', _t.handoff_id, '/tickets/' || _t.ticket_id::text, 'urgent', NULL, true, _t.is_demo)
        WHERE id = _log;
        _sent := _sent + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN _sent;
END;
$function$;
