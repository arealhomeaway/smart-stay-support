-- Additive undo: retains new tables/history. No post-apply action or assigned record is silently undone.
SELECT cron.unschedule('ops-simplification-assign-once') WHERE EXISTS (SELECT 1 FROM public.ops_assignment_batch WHERE finished_at IS NULL);
DROP POLICY IF EXISTS ops_live_only ON public.tickets;
DROP POLICY IF EXISTS ops_live_only ON public.routine_controls;
DROP POLICY IF EXISTS ops_live_only ON public.leads;
DROP POLICY IF EXISTS ops_live_only ON public.escalations;
DROP POLICY IF EXISTS ops_live_only ON public.handoffs;
DROP POLICY IF EXISTS ops_live_only ON public.work_orders;
DROP POLICY IF EXISTS ops_live_only ON public.staff_notifications;
DROP TRIGGER IF EXISTS a_ops_backlog_stamp ON public.tickets;
DROP TRIGGER IF EXISTS a_ops_backlog_stamp ON public.routine_controls;
DROP TRIGGER IF EXISTS a_ops_backlog_stamp ON public.leads;
DROP TRIGGER IF EXISTS b_ops_review_assign ON public.routine_controls;
DROP TRIGGER IF EXISTS a_ops_notification_guard ON public.staff_notifications;
DROP TRIGGER IF EXISTS a_ops_escalation_guard ON public.escalations;
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  -- Automated sources stay unowned (Emily, Nov 7, 2026; register T15): the info inbox,
  -- OwnerRez and Breezeway. They wait in the Team Queue for their team to take them.
  IF lower(coalesce(NEW.external_source, '')) IN ('email', 'ownerrez', 'breezeway') THEN
    NEW.assignment_note := 'Waiting in the Team Queue for the team to take it.';
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM public.ticket_route_at(NEW.functional_role_code, NEW.work_type_id, now());
  NEW.current_action_owner := r.user_id;
  NEW.assigned_to := r.user_id;
  NEW.assignment_source := r.source;
  NEW.assignment_note := r.note;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION private.arrival_check_create(_booking text, _check_in timestamp with time zone, _late boolean, _at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  r public.arrival_reservations;
  _tz text;
  _label text;
  _wt uuid;
  _ticket uuid;
  _check uuid;
  _deadline timestamptz := _check_in - interval '2 hours';
  _guests integer;
  _desc text;
BEGIN
  SELECT * INTO r FROM public.arrival_reservations WHERE ownerrez_booking_id = _booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found.'; END IF;
  SELECT coalesce(nullif(btrim(time_zone), ''), 'America/Chicago') INTO _tz FROM public.properties WHERE id = r.property_id;
  _tz := coalesce(_tz, 'America/Chicago');
  _label := coalesce(private.arrival_home_label(r.property_id), 'Home');
  SELECT id INTO _wt FROM public.work_types WHERE name = 'Arrival check' ORDER BY created_at LIMIT 1;
  _guests := nullif(coalesce(r.adults, 0) + coalesce(r.children, 0) + coalesce(r.infants, 0), 0);
  _desc := 'Guest arrives at ' || private.arrival_fmt_time(_check_in, _tz) || '. Check the home by '
           || private.arrival_fmt_time(_deadline, _tz) || ', or flag the issue with a safe backup plan.';
  INSERT INTO public.tickets
    (record_type, title, description, property_id, priority, suggested_priority, status, source_channel,
     initiator_type, external_source, external_id, reported_at, department_code, functional_role_code,
     work_type_id, is_demo, due_at, next_action, next_action_due_at, guest_in_residence,
     reservation_guest_name, reservation_arrival, reservation_departure, reservation_guest_count,
     reservation_snapshot_at, response_due_at, action_due_at)
  VALUES ('active_task', 'Arrival check: ' || _label || CASE WHEN r.is_test THEN ' (test)' ELSE '' END, _desc,
          CASE WHEN r.is_test THEN NULL ELSE r.property_id END, 'p2', 'p2', 'open', 'ownerrez', 'external',
          'ownerrez', 'arrival:' || _booking, _at, 'operations', 'po_day', _wt, r.is_test, _deadline,
          'Check the home is ready for the guest', _deadline, false, r.guest_first_name, r.arrival_on,
          r.departure_on, _guests, _at, _at + interval '30 minutes', _at + interval '60 minutes')
  RETURNING id INTO _ticket;
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  INSERT INTO public.arrival_checks
    (ownerrez_booking_id, property_id, ticket_id, home_label, arrival_on, check_in_at, deadline_at, time_zone,
     team, owner_stay, late_booking, is_test, guest_first_name, guests, pets, created_at)
  VALUES (_booking, r.property_id, _ticket, _label, r.arrival_on, _check_in, _deadline, _tz,
          'property_operations', r.owner_stay, coalesce(_late, false), r.is_test, r.guest_first_name, _guests,
          r.pets, _at)
  RETURNING id INTO _check;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  UPDATE public.arrival_reservations SET decision = 'created', decision_reason = NULL, decided_at = _at
   WHERE ownerrez_booking_id = _booking;
  RETURN _check;
END $function$

CREATE OR REPLACE FUNCTION private.ticket_owner_wait_clock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _wait interval;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NULL THEN
      NEW.unowned_since := coalesce(NEW.unowned_since, NEW.reported_at, now());
    ELSE
      NEW.unowned_since := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL THEN
    -- Given back: it waits for an owner again from now.
    NEW.unowned_since := now();
  ELSIF OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL THEN
    -- Taken: the wait never counts against the person who takes it.
    IF OLD.unowned_since IS NOT NULL THEN
      _wait := greatest(now() - OLD.unowned_since, interval '0');
      IF OLD.acknowledged_at IS NULL AND NEW.response_due_at IS NOT NULL
         AND NEW.response_due_at IS NOT DISTINCT FROM OLD.response_due_at THEN
        NEW.response_due_at := NEW.response_due_at + _wait;
      END IF;
      IF OLD.action_started_at IS NULL AND NEW.action_due_at IS NOT NULL
         AND NEW.action_due_at IS NOT DISTINCT FROM OLD.action_due_at THEN
        NEW.action_due_at := NEW.action_due_at + _wait;
      END IF;
    END IF;
    NEW.unowned_since := NULL;
  END IF;
  RETURN NEW;
END;
$function$

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
$function$

CREATE OR REPLACE FUNCTION public.escalate_direct_booking_approvals()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row record; n integer := 0; _wait int := coalesce((public.direct_booking_settings()->>'approvalWaitMinutes')::int, 2);
BEGIN
  FOR _row IN SELECT id, lead_id FROM public.direct_booking_approvals
     WHERE decision IS NULL AND escalated_at IS NULL AND requested_at <= now() - make_interval(mins => _wait)
     FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.direct_booking_approvals SET escalated_at = now() WHERE id = _row.id;
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('director_ops')),
      'direct_booking_escalated', 'A direct booking reply is still waiting',
      'No approval after ' || _wait || ' minutes. You can approve it now.', _row.lead_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$

CREATE OR REPLACE FUNCTION public.release_overnight_direct_bookings(_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record; _users uuid[]; _n integer := 0; _start text; _clock text;
BEGIN
  IF public.direct_booking_overnight_until(_at) IS NOT NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE kind = 'direct_booking' AND overnight_until <= _at
                   AND morning_alerted_at IS NULL AND owned_by IS NULL AND outcome IS NULL AND reply_sent_at IS NULL) THEN
    RETURN 0;
  END IF;
  _users := ARRAY(SELECT public.direct_booking_on_shift(_at));
  -- The Overnight reply clock starts at setting (register D3), default 9:00 AM.
  _start := (SELECT value->>'overnightClockStart' FROM public.app_settings WHERE key = 'direct_booking_settings');
  IF _start IS NULL OR _start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN _start := '09:00'; END IF;
  _clock := to_char(('2000-01-01 ' || _start)::timestamp, 'FMHH12:MI AM');
  FOR _r IN
    SELECT id, partner_name, company FROM public.leads
     WHERE kind = 'direct_booking' AND overnight_until <= _at AND morning_alerted_at IS NULL
       AND owned_by IS NULL AND outcome IS NULL AND reply_sent_at IS NULL
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.direct_booking_notify(
      _users,
      'direct_booking_new',
      'New direct booking request',
      coalesce(_r.partner_name, _r.company, 'A partner') || ' wrote overnight and is waiting. Press Start to own it. Reply clock starts at ' || _clock || '.',
      _r.id);
    UPDATE public.leads SET morning_alerted_at = _at WHERE id = _r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'release_overnight_direct_bookings: %', SQLERRM;
  RETURN 0;
END $function$

CREATE OR REPLACE FUNCTION public.direct_booking_daily_summary(_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _day date := ((_at AT TIME ZONE 'America/Chicago')::date - 1); _count int; _body text;
BEGIN
  IF extract(hour FROM _at AT TIME ZONE 'America/Chicago') < 7 THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_notifications WHERE kind = 'direct_booking_daily' AND title LIKE '%' || to_char(_day, 'Mon FMDD') || '%') THEN RETURN 0; END IF;
  SELECT count(*), string_agg(coalesce(partner_name, company, 'Partner') || ': ' || coalesce(reply_subject, ''), E'\n' ORDER BY reply_sent_at)
    INTO _count, _body
    FROM public.leads WHERE kind = 'direct_booking' AND (reply_sent_at AT TIME ZONE 'America/Chicago')::date = _day;
  IF _count = 0 THEN RETURN 0; END IF;
  INSERT INTO public.staff_notifications(user_id, kind, title, body, link_path, priority)
  SELECT u, 'direct_booking_daily', 'Direct booking replies sent ' || to_char(_day, 'Mon FMDD') || ': ' || _count, _body, '/direct-bookings', 'normal'
    FROM public.functional_role_holders('ops_supervisor') u;
  RETURN _count;
END $function$

CREATE OR REPLACE FUNCTION public.coordinators_on_shift(_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(user_id uuid, role_code text, team text, covering boolean, at_lunch boolean, load integer, last_given timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH l AS (
    SELECT EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int AS wd,
           (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
            + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int) AS m
  ), r AS (
    SELECT fr.code, fr.team,
           public.seat_holder_at(fr.code, _at) AS uid,
           coalesce((SELECT o.kind FROM public.seat_override_at(fr.code, _at) o) = 'cover', false) AS covering
    FROM public.functional_roles fr
    WHERE fr.active
      AND fr.code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening')
      AND public.seat_eligible_now(fr.code, _at)
  )
  SELECT r.uid, r.code, r.team, r.covering,
    EXISTS (
      SELECT 1 FROM public.coverage_shifts s, l
      WHERE s.role_code = r.code AND s.active AND s.weekday = l.wd
        AND s.lunch_start_minute IS NOT NULL
        AND l.m >= s.lunch_start_minute AND l.m < s.lunch_end_minute),
    coalesce((
      SELECT sum(CASE t.priority WHEN 'p1' THEN 5 WHEN 'p2' THEN 3 ELSE 1 END)
      FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.status NOT IN ('resolved', 'closed', 'waiting')
        AND t.archived_at IS NULL
        AND NOT coalesce(t.is_demo, false)
        AND NOT (t.external_source IS NOT DISTINCT FROM 'notion'
                 AND t.external_status IS DISTINCT FROM 'reopened_in_resolve')), 0)::int,
    (SELECT max(t.created_at) FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.assignment_source IN ('automatic', 'breezeway_auto_route'))
  FROM r
  WHERE public.staff_assignable(r.uid)
$function$

CREATE OR REPLACE FUNCTION public.notify_staff(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid, _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.staff_notifications (
    user_id, kind, title, body, entity_type, entity_id, link_path,
    priority, actor_id, email_status, is_demo
  ) VALUES (
    _user_id, _kind, _title, coalesce(_body, ''), _entity_type, _entity_id, _link_path,
    coalesce(_priority, 'normal'), _actor_id,
    CASE WHEN _email AND NOT coalesce(_is_demo, false) THEN 'pending' ELSE 'none' END,
    coalesce(_is_demo, false)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$

CREATE OR REPLACE FUNCTION public.email_delivery_allowed(_recipients text[], _entity_type text DEFAULT NULL::text, _entity_id uuid DEFAULT NULL::uuid, _ticket_id uuid DEFAULT NULL::uuid, _actor_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE address text; tab text; row_data jsonb;
BEGIN
 IF cardinality(_recipients) IS NULL OR cardinality(_recipients)=0 THEN RETURN false; END IF;
 FOREACH address IN ARRAY _recipients LOOP
  IF address IS NULL OR address !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$'
    OR address ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE lower(trim(p.email))=lower(trim(address))
      AND u.email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.owner_programs p WHERE p.is_demo
    AND (lower(trim(p.owner_email))=lower(trim(address)) OR p.owner_user_id IN
      (SELECT id FROM auth.users WHERE lower(trim(email))=lower(trim(address))))) THEN RETURN false; END IF;
 END LOOP;
 IF _actor_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=_actor_id
   AND email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN RETURN false; END IF;
 IF _ticket_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tickets WHERE id=_ticket_id AND is_demo=false) THEN RETURN false; END IF;
 IF _entity_type IS NOT NULL THEN
  tab := CASE _entity_type
    WHEN 'owner_program' THEN 'owner_programs' WHEN 'owner_notification' THEN 'owner_notifications'
    WHEN 'staff_notification' THEN 'staff_notifications' WHEN 'ticket' THEN 'tickets'
    WHEN 'property' THEN 'properties' WHEN 'work_order' THEN 'work_orders'
    WHEN 'onboarding_task' THEN 'onboarding_tasks' WHEN 'work_item' THEN 'work_items'
    WHEN 'help_ticket' THEN 'help_tickets' WHEN 'approval' THEN 'approvals'
    WHEN 'handoff' THEN 'handoffs'
    WHEN 'claim' THEN 'claims' WHEN 'vendor_org' THEN 'vendor_orgs'
    WHEN 'onboarding_project' THEN 'onboarding_projects' WHEN 'owner_review' THEN 'owner_reviews'
    WHEN 'financial_request' THEN 'financial_requests' ELSE NULL END;
  IF tab IS NULL OR _entity_id IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',tab) INTO row_data USING _entity_id;
  IF row_data IS NULL OR coalesce((row_data->>'is_demo')::boolean,false) THEN RETURN false; END IF;
  IF row_data->>'property_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=(row_data->>'property_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF row_data->>'program_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.owner_programs WHERE id=(row_data->>'program_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF row_data->>'project_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.onboarding_projects WHERE id=(row_data->>'project_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF tab='staff_notifications' AND row_data->>'entity_id' IS NOT NULL THEN
    RETURN public.email_delivery_allowed(_recipients,
      CASE row_data->>'entity_type' WHEN 'vendor' THEN 'vendor_org' ELSE row_data->>'entity_type' END,
      (row_data->>'entity_id')::uuid,NULL,_actor_id);
  END IF;
 END IF;
 RETURN true;
END $function$

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
$function$

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$

CREATE OR REPLACE FUNCTION public.keep_reopened_notion_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('resolve.import_quiet', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $function$

SELECT set_config('resolve.import_quiet','on',true);
UPDATE public.tickets SET ops_backlog_at=NULL WHERE ops_live_at IS NULL;
UPDATE public.routine_controls SET ops_backlog_at=NULL WHERE ops_live_at IS NULL;
UPDATE public.leads SET ops_backlog_at=NULL WHERE ops_live_at IS NULL;
SELECT set_config('resolve.import_quiet','',true);