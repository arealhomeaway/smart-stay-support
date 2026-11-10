-- Undo for 02_arrival_check_fixes.sql: puts back the three functions exactly as 01 made them.

CREATE OR REPLACE FUNCTION private.arrival_fmt_time(_at timestamptz, _tz text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT to_char(_at AT TIME ZONE coalesce(nullif(_tz, ''), 'America/Chicago'), 'FMHH12:MI AM');
$$;

-- 11. Complete a check. The person who completes it gets the credit; an unowned check is taken.
CREATE OR REPLACE FUNCTION private.arrival_check_complete(
  _me uuid, _check uuid, _lock_connected boolean, _lock_note text, _work_orders_reviewed boolean,
  _outcome text, _issue text, _backup_plan text, _at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  c public.arrival_checks;
  t record;
  _result text;
  _first uuid;
  _issue_ticket uuid;
  _note text := nullif(btrim(coalesce(_lock_note, '')), '');
  _issue_txt text := nullif(btrim(coalesce(_issue, '')), '');
  _plan text := nullif(btrim(coalesce(_backup_plan, '')), '');
  _summary text;
BEGIN
  IF _me IS NULL OR NOT (private.has_role(_me, 'admin') OR private.has_role(_me, 'manager')
                         OR private.has_role(_me, 'tech')) THEN
    RAISE EXCEPTION 'Only the operations team can complete an arrival check.';
  END IF;
  SELECT * INTO c FROM public.arrival_checks WHERE id = _check FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This arrival check was not found.'; END IF;
  IF c.status <> 'open' OR c.cleared_at IS NOT NULL THEN
    RAISE EXCEPTION 'This arrival check is already done.';
  END IF;
  IF _lock_connected IS NULL THEN RAISE EXCEPTION 'Say whether the lock shows connected.'; END IF;
  IF NOT _lock_connected AND _note IS NULL THEN RAISE EXCEPTION 'Add a short note about the lock.'; END IF;
  IF _work_orders_reviewed IS NOT TRUE THEN RAISE EXCEPTION 'Review the open Breezeway work orders first.'; END IF;
  IF _outcome NOT IN ('ready', 'issue') THEN RAISE EXCEPTION 'Choose ready or issue found.'; END IF;
  IF _outcome = 'issue' AND (_issue_txt IS NULL OR _plan IS NULL) THEN
    RAISE EXCEPTION 'Say what the issue is and the safe backup plan.';
  END IF;
  SELECT id, assigned_to, status, is_demo, property_id INTO t FROM public.tickets WHERE id = c.ticket_id FOR UPDATE;
  IF t.assigned_to IS NOT NULL AND t.assigned_to <> _me
     AND NOT (private.has_role(_me, 'admin') OR private.has_role(_me, 'manager')) THEN
    RAISE EXCEPTION 'Someone else has this arrival check.';
  END IF;
  IF t.assigned_to IS NULL THEN
    UPDATE public.tickets SET assigned_to = _me, acknowledged_at = coalesce(acknowledged_at, _at) WHERE id = c.ticket_id;
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
    VALUES (c.ticket_id, _me, 'note', 'claimed', 'Took the arrival check.', true, coalesce(t.is_demo, false));
  END IF;

  _result := CASE WHEN c.result = 'missed' THEN 'missed'
                  WHEN _at <= c.deadline_at THEN 'on_time'
                  WHEN _at < c.check_in_at THEN 'late'
                  ELSE 'missed' END;

  IF _outcome = 'issue' THEN
    INSERT INTO public.tickets
      (record_type, title, description, property_id, priority, suggested_priority, status, source_channel,
       initiator_type, external_source, external_id, reported_at, department_code, functional_role_code,
       is_demo, guest_in_residence, response_due_at, action_due_at)
    VALUES ('active_task', 'Arrival issue: ' || c.home_label,
            'Found on the arrival check. Issue: ' || _issue_txt || ' Backup plan: ' || _plan,
            t.property_id, 'p2', 'p2', 'open', 'ownerrez', 'external', 'ownerrez', 'arrival-issue:' || c.ownerrez_booking_id,
            _at, 'operations', 'po_day', coalesce(t.is_demo, false), false,
            _at + interval '30 minutes', _at + interval '60 minutes')
    RETURNING id INTO _issue_ticket;
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
    VALUES (_issue_ticket, _me, 'note', 'arrival_issue', 'From the arrival check. Backup plan: ' || _plan, true,
            coalesce(t.is_demo, false));
  END IF;

  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  UPDATE public.arrival_checks
     SET status = 'complete', lock_connected = _lock_connected, lock_note = _note,
         work_orders_reviewed = true, outcome = _outcome, issue_text = _issue_txt, backup_plan = _plan,
         issue_ticket_id = _issue_ticket, completed_by = _me, completed_at = _at,
         result = _result, result_at = coalesce(result_at, _at)
   WHERE id = _check
   RETURNING * INTO c;
  PERFORM set_config('resolve.arrival_check_writing', '', true);

  _summary := 'Arrival check done. Lock ' || CASE WHEN _lock_connected THEN 'connected' ELSE 'not connected: ' || _note END
              || '. Breezeway work orders reviewed. '
              || CASE WHEN _outcome = 'ready' THEN 'Home ready.'
                      ELSE 'Issue: ' || _issue_txt || ' Backup plan: ' || _plan END;
  UPDATE public.tickets
     SET status = 'closed', resolved_at = _at, resolution_notes = _summary, closure_evidence = _summary,
         outcome_type = CASE WHEN _outcome = 'ready' THEN 'no_issue_found' ELSE 'resolved' END,
         closure_qa_result = 'not_required', action_started_at = coalesce(action_started_at, _at),
         acknowledged_at = coalesce(acknowledged_at, _at)
   WHERE id = c.ticket_id;
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
  VALUES (c.ticket_id, _me, 'note', 'arrival_check_done', _summary, true, coalesce(t.is_demo, false));

  IF c.result_at < _at AND _result = 'missed' THEN
    SELECT id INTO _first FROM public.scorecard_records
     WHERE kind = 'arrival_check' AND details ->> 'check_id' = c.id::text AND refers_to IS NULL
     ORDER BY recorded_at LIMIT 1;
    PERFORM private.arrival_check_fact(c.id, 'completed_after_check_in', _first, _at);
  ELSE
    PERFORM private.arrival_check_fact(c.id, 'result', NULL, _at);
  END IF;
  RETURN jsonb_build_object('check_id', c.id, 'result', _result, 'issue_ticket_id', _issue_ticket);
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_complete(uuid, uuid, boolean, text, boolean, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;


-- 10. The fact the scorecard reads later. Late bookings are recorded but never counted.
CREATE OR REPLACE FUNCTION private.arrival_check_fact(_check uuid, _event text, _refers uuid, _at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  c public.arrival_checks;
  _owner uuid;
  _about uuid;
  _credit text;
  _id uuid;
BEGIN
  SELECT * INTO c FROM public.arrival_checks WHERE id = _check;
  SELECT assigned_to INTO _owner FROM public.tickets WHERE id = c.ticket_id;
  _about := coalesce(c.completed_by, _owner);
  IF _about IS NULL THEN
    _about := public.seat_holder_at('ops_supervisor', least(_at, c.check_in_at));
    _credit := 'ops_supervisor_team_follow_through';
  ELSE
    _credit := 'coordinator_homes_ready';
  END IF;
  INSERT INTO public.scorecard_records
    (kind, recorded_by, recorded_at, about_user_id, property_id, stay_ref, ticket_id, details, refers_to, is_demo)
  VALUES ('arrival_check', coalesce(c.completed_by, _owner, _about, '00000000-0000-0000-0000-000000000000'::uuid),
          _at, _about, c.property_id, c.ownerrez_booking_id, c.ticket_id,
          jsonb_build_object('event', _event, 'check_id', c.id, 'result', c.result, 'outcome', c.outcome,
                             'arrival_on', c.arrival_on, 'check_in_at', c.check_in_at, 'deadline_at', c.deadline_at,
                             'completed_at', c.completed_at, 'completed_by', c.completed_by,
                             'late_booking', c.late_booking, 'counted', NOT c.late_booking AND NOT c.is_test,
                             'counts_for', _credit, 'owner_stay', c.owner_stay, 'team', c.team),
          _refers, c.is_test)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_fact(uuid, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

