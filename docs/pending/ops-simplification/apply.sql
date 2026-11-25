-- Approved: apply ops-simplification. Cutover is Nov 16, 2026 in Central time.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ops_backlog_at timestamptz, ADD COLUMN IF NOT EXISTS ops_live_at timestamptz, ADD COLUMN IF NOT EXISTS ops_assigned_at timestamptz;
ALTER TABLE public.routine_controls ADD COLUMN IF NOT EXISTS ops_backlog_at timestamptz, ADD COLUMN IF NOT EXISTS ops_live_at timestamptz, ADD COLUMN IF NOT EXISTS ops_archived_at timestamptz, ADD COLUMN IF NOT EXISTS ops_assigned_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ops_backlog_at timestamptz, ADD COLUMN IF NOT EXISTS ops_live_at timestamptz, ADD COLUMN IF NOT EXISTS ops_archived_at timestamptz;
CREATE TABLE public.ops_backlog_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL, entity_id uuid NOT NULL, action text NOT NULL, reason text NOT NULL, actor_id uuid, before_value jsonb NOT NULL, after_value jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ops_backlog_history TO authenticated;
GRANT ALL ON public.ops_backlog_history TO service_role;
ALTER TABLE public.ops_backlog_history ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ops_assignment_batch(id text PRIMARY KEY, run_at timestamptz NOT NULL, finished_at timestamptz, result jsonb);
GRANT SELECT ON public.ops_assignment_batch TO authenticated;
GRANT ALL ON public.ops_assignment_batch TO service_role;
ALTER TABLE public.ops_assignment_batch ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ops_assignment_batch_items(batch_id text NOT NULL REFERENCES public.ops_assignment_batch(id), entity_type text NOT NULL, entity_id uuid NOT NULL, PRIMARY KEY(batch_id,entity_type,entity_id));
GRANT SELECT ON public.ops_assignment_batch_items TO authenticated;
GRANT ALL ON public.ops_assignment_batch_items TO service_role;
ALTER TABLE public.ops_assignment_batch_items ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.ops_backlog_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private AS $$ SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR private.sc_is_ops_supervisor(auth.uid()) OR public.is_director(auth.uid()) OR public.is_onboarding_director(auth.uid())) $$;
REVOKE ALL ON FUNCTION public.ops_backlog_manager() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_backlog_manager() TO authenticated,service_role;
CREATE POLICY ops_history_manager ON public.ops_backlog_history FOR SELECT TO authenticated USING(public.ops_backlog_manager());
CREATE POLICY ops_batch_manager ON public.ops_assignment_batch FOR SELECT TO authenticated USING(public.ops_backlog_manager());
CREATE POLICY ops_batch_items_manager ON public.ops_assignment_batch_items FOR SELECT TO authenticated USING(public.ops_backlog_manager());
CREATE OR REPLACE FUNCTION public.ops_is_backlog_entity(_type text,_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,private AS $$
DECLARE v boolean := false; parent uuid;
BEGIN
 IF _id IS NULL THEN RETURN false; END IF;
 CASE _type
 WHEN 'ticket' THEN SELECT ops_backlog_at IS NOT NULL INTO v FROM public.tickets WHERE id=_id;
 WHEN 'routine' THEN SELECT ops_backlog_at IS NOT NULL OR ops_archived_at IS NOT NULL INTO v FROM public.routine_controls WHERE id=_id;
 WHEN 'routine_control' THEN SELECT ops_backlog_at IS NOT NULL OR ops_archived_at IS NOT NULL INTO v FROM public.routine_controls WHERE id=_id;
 WHEN 'lead' THEN SELECT ops_backlog_at IS NOT NULL OR ops_archived_at IS NOT NULL INTO v FROM public.leads WHERE id=_id;
 WHEN 'direct_booking' THEN SELECT ops_backlog_at IS NOT NULL OR ops_archived_at IS NOT NULL INTO v FROM public.leads WHERE id=_id;
 WHEN 'work_order' THEN SELECT ticket_id INTO parent FROM public.work_orders WHERE id=_id; v := public.ops_is_backlog_entity('ticket',parent);
 WHEN 'handoff' THEN SELECT ticket_id INTO parent FROM public.handoffs WHERE id=_id; v := public.ops_is_backlog_entity('ticket',parent);
 WHEN 'escalation' THEN SELECT ticket_id INTO parent FROM public.escalations WHERE id=_id; v := public.ops_is_backlog_entity('ticket',parent);
 WHEN 'direct_booking_approval' THEN SELECT lead_id INTO parent FROM public.direct_booking_approvals WHERE id=_id; v := public.ops_is_backlog_entity('lead',parent);
 WHEN 'approval' THEN SELECT entity_id INTO parent FROM public.approvals WHERE id=_id AND entity_type='ticket'; v := public.ops_is_backlog_entity('ticket',parent);
 ELSE v := false;
 END CASE;
 RETURN coalesce(v,false);
END $$;
REVOKE ALL ON FUNCTION public.ops_is_backlog_entity(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_is_backlog_entity(text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION private.ops_backlog_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF TG_TABLE_NAME='tickets' THEN
   IF NEW.ops_live_at IS NULL AND (NEW.external_source='notion' OR (NEW.created_at<'2026-11-16 00:00:00-06'::timestamptz AND NEW.status NOT IN ('resolved','closed'))) THEN NEW.ops_backlog_at:=coalesce(NEW.ops_backlog_at,now()); END IF;
  ELSIF TG_TABLE_NAME='routine_controls' THEN
   IF NEW.ops_live_at IS NULL AND NEW.kind='maintenance_review' AND NEW.status IN ('due','in_progress') AND NEW.created_at<'2026-11-16 00:00:00-06'::timestamptz THEN NEW.ops_backlog_at:=coalesce(NEW.ops_backlog_at,now()); END IF;
  ELSE
   IF NEW.ops_live_at IS NULL AND NEW.kind='direct_booking' AND NEW.outcome IS NULL AND NEW.created_at<'2026-11-16 00:00:00-06'::timestamptz THEN NEW.ops_backlog_at:=coalesce(NEW.ops_backlog_at,now()); END IF;
  END IF;
 ELSIF NEW.ops_backlog_at IS DISTINCT FROM OLD.ops_backlog_at OR NEW.ops_live_at IS DISTINCT FROM OLD.ops_live_at THEN
  IF coalesce(current_setting('resolve.ops_transition',true),'')<>'on' THEN RAISE EXCEPTION 'Use Old backlog to move this work.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_ops_backlog_stamp BEFORE INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION private.ops_backlog_stamp();
CREATE TRIGGER a_ops_backlog_stamp BEFORE INSERT OR UPDATE ON public.routine_controls FOR EACH ROW EXECUTE FUNCTION private.ops_backlog_stamp();
CREATE TRIGGER a_ops_backlog_stamp BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION private.ops_backlog_stamp();
CREATE OR REPLACE FUNCTION private.ops_review_assign() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 IF NEW.kind='maintenance_review' AND NEW.status IN ('due','in_progress') AND NEW.ops_backlog_at IS NULL THEN
  SELECT * INTO r FROM public.ticket_route_at('po_day',NULL,now());
  NEW.assigned_to:=r.user_id; NEW.assigned_role_code:=r.role_code; NEW.ops_assigned_at:=now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b_ops_review_assign BEFORE INSERT ON public.routine_controls FOR EACH ROW EXECUTE FUNCTION private.ops_review_assign();
CREATE OR REPLACE FUNCTION private.ops_notification_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.ops_is_backlog_entity(NEW.entity_type,NEW.entity_id) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_ops_notification_guard BEFORE INSERT ON public.staff_notifications FOR EACH ROW EXECUTE FUNCTION private.ops_notification_guard();
CREATE OR REPLACE FUNCTION private.ops_escalation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.ops_is_backlog_entity('ticket',NEW.ticket_id) THEN RAISE EXCEPTION 'Move this item to live work first.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_ops_escalation_guard BEFORE INSERT ON public.escalations FOR EACH ROW EXECUTE FUNCTION private.ops_escalation_guard();
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

  IF NEW.ops_backlog_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT * INTO r FROM public.ticket_route_at(
    CASE WHEN NEW.functional_role_code LIKE 'ge\_%' OR NEW.work_type_id IN (SELECT id FROM public.work_types WHERE name = 'Arrival check') THEN 'ge_day' ELSE 'po_day' END, NULL, now());
  NEW.current_action_owner := r.user_id;
  NEW.assigned_to := r.user_id;
  NEW.assignment_source := r.source;
  NEW.assignment_note := r.note;
  RETURN NEW;
END;
$function$
;
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
          'ownerrez', 'arrival:' || _booking, _at, 'operations', 'ge_day', _wt, r.is_test, _deadline,
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
;
CREATE OR REPLACE FUNCTION private.ticket_owner_wait_clock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _wait interval;
BEGIN
  IF NEW.ops_backlog_at IS NOT NULL OR (TG_OP = 'UPDATE' AND OLD.ops_backlog_at IS NOT NULL) THEN RETURN NEW; END IF;
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
;
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
       AND ops_backlog_at IS NULL
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
       AND ops_backlog_at IS NULL
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
;
CREATE OR REPLACE FUNCTION public.escalate_direct_booking_approvals()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row record; n integer := 0; _wait int := coalesce((public.direct_booking_settings()->>'approvalWaitMinutes')::int, 2);
BEGIN
  FOR _row IN SELECT id, lead_id FROM public.direct_booking_approvals
     WHERE NOT public.ops_is_backlog_entity('lead', lead_id) AND decision IS NULL AND escalated_at IS NULL AND requested_at <= now() - make_interval(mins => _wait)
     FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.direct_booking_approvals SET escalated_at = now() WHERE id = _row.id;
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('director_ops')),
      'direct_booking_escalated', 'A direct booking reply is still waiting',
      'No approval after ' || _wait || ' minutes. You can approve it now.', _row.lead_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$
;
CREATE OR REPLACE FUNCTION public.release_overnight_direct_bookings(_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record; _users uuid[]; _n integer := 0; _start text; _clock text;
BEGIN
  IF public.direct_booking_overnight_until(_at) IS NOT NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE ops_backlog_at IS NULL AND ops_archived_at IS NULL AND kind = 'direct_booking' AND overnight_until <= _at
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
     WHERE ops_backlog_at IS NULL AND ops_archived_at IS NULL AND kind = 'direct_booking' AND overnight_until <= _at AND morning_alerted_at IS NULL
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
;
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
    FROM public.leads WHERE ops_backlog_at IS NULL AND ops_archived_at IS NULL AND kind = 'direct_booking' AND (reply_sent_at AT TIME ZONE 'America/Chicago')::date = _day;
  IF _count = 0 THEN RETURN 0; END IF;
  INSERT INTO public.staff_notifications(user_id, kind, title, body, link_path, priority)
  SELECT u, 'direct_booking_daily', 'Direct booking replies sent ' || to_char(_day, 'Mon FMDD') || ': ' || _count, _body, '/direct-bookings', 'normal'
    FROM public.functional_role_holders('ops_supervisor') u;
  RETURN _count;
END $function$
;
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
        AND t.ops_backlog_at IS NULL
        AND NOT coalesce(t.is_demo, false)
        AND NOT (t.external_source IS NOT DISTINCT FROM 'notion'
                 AND t.external_status IS DISTINCT FROM 'reopened_in_resolve')), 0)::int + coalesce((SELECT count(*) FROM public.routine_controls rc WHERE rc.assigned_to = r.uid AND rc.kind = 'maintenance_review' AND rc.status IN ('due','in_progress') AND rc.ops_backlog_at IS NULL AND rc.ops_archived_at IS NULL AND NOT rc.is_demo),0)::int,
    (SELECT max(coalesce(t.ops_assigned_at,t.created_at)) FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.assignment_source IN ('automatic', 'breezeway_auto_route'))
  FROM r
  WHERE public.staff_assignable(r.uid)
$function$
;
CREATE OR REPLACE FUNCTION public.notify_staff(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid, _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
BEGIN
  IF public.ops_is_backlog_entity(_entity_type, _entity_id) THEN RETURN NULL; END IF;
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
;
CREATE OR REPLACE FUNCTION public.email_delivery_allowed(_recipients text[], _entity_type text DEFAULT NULL::text, _entity_id uuid DEFAULT NULL::uuid, _ticket_id uuid DEFAULT NULL::uuid, _actor_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE address text; tab text; row_data jsonb;
BEGIN
  IF public.ops_is_backlog_entity(_entity_type, _entity_id) OR public.ops_is_backlog_entity('ticket', _ticket_id) THEN RETURN false; END IF;
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
;
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
  IF public.ops_is_backlog_entity('ticket', _ticket_id) THEN RAISE EXCEPTION 'Move this item to live work first.'; END IF;
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
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) ? 'ops_backlog_at' AND (to_jsonb(NEW) - 'ops_backlog_at' - 'ops_live_at' - 'ops_archived_at' - 'ops_assigned_at') = (to_jsonb(OLD) - 'ops_backlog_at' - 'ops_live_at' - 'ops_archived_at' - 'ops_assigned_at') THEN RETURN NEW; END IF;
 NEW.updated_at = now(); RETURN NEW; END; $function$
;
CREATE OR REPLACE FUNCTION public.keep_reopened_notion_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.ops_backlog_at IS DISTINCT FROM OLD.ops_backlog_at AND current_setting('resolve.ops_transition',true)='on' THEN RETURN NEW; END IF;
  IF coalesce(current_setting('resolve.import_quiet', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $function$
;

SELECT set_config('resolve.ops_transition','on',true);
SELECT set_config('resolve.import_quiet','on',true);
WITH moved AS (UPDATE public.tickets SET ops_backlog_at=now() WHERE ops_backlog_at IS NULL AND (external_source='notion' OR (status NOT IN ('resolved','closed') AND archived_at IS NULL AND created_at<'2026-11-16 00:00:00-06'::timestamptz)) RETURNING *) INSERT INTO public.ops_backlog_history(entity_type,entity_id,action,reason,before_value,after_value) SELECT 'ticket',id,'separated','Before Operations go-live',to_jsonb(moved)-'ops_backlog_at',jsonb_build_object('ops_backlog_at',ops_backlog_at) FROM moved;
WITH moved AS (UPDATE public.routine_controls SET ops_backlog_at=now() WHERE ops_backlog_at IS NULL AND kind='maintenance_review' AND status IN ('due','in_progress') AND created_at<'2026-11-16 00:00:00-06'::timestamptz RETURNING *) INSERT INTO public.ops_backlog_history(entity_type,entity_id,action,reason,before_value,after_value) SELECT 'routine',id,'separated','Before Operations go-live',to_jsonb(moved)-'ops_backlog_at',jsonb_build_object('ops_backlog_at',ops_backlog_at) FROM moved;
WITH moved AS (UPDATE public.leads SET ops_backlog_at=now() WHERE ops_backlog_at IS NULL AND kind='direct_booking' AND outcome IS NULL AND stage NOT IN ('converted','lost') AND created_at<'2026-11-16 00:00:00-06'::timestamptz RETURNING *) INSERT INTO public.ops_backlog_history(entity_type,entity_id,action,reason,before_value,after_value) SELECT 'lead',id,'separated','Before Operations go-live',to_jsonb(moved)-'ops_backlog_at',jsonb_build_object('ops_backlog_at',ops_backlog_at) FROM moved;
SELECT set_config('resolve.import_quiet','',true);
SELECT set_config('resolve.ops_transition','',true);
CREATE POLICY ops_live_only ON public.tickets AS RESTRICTIVE FOR ALL TO authenticated USING(ops_backlog_at IS NULL) WITH CHECK(ops_backlog_at IS NULL);
CREATE POLICY ops_live_only ON public.routine_controls AS RESTRICTIVE FOR ALL TO authenticated USING(ops_backlog_at IS NULL AND ops_archived_at IS NULL) WITH CHECK(ops_backlog_at IS NULL AND ops_archived_at IS NULL);
CREATE POLICY ops_live_only ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING(ops_backlog_at IS NULL AND ops_archived_at IS NULL) WITH CHECK(ops_backlog_at IS NULL AND ops_archived_at IS NULL);
CREATE POLICY ops_live_only ON public.escalations AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.ops_is_backlog_entity('escalation',id));
CREATE POLICY ops_live_only ON public.handoffs AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.ops_is_backlog_entity('handoff',id));
CREATE POLICY ops_live_only ON public.work_orders AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.ops_is_backlog_entity('work_order',id));
CREATE POLICY ops_live_only ON public.staff_notifications AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.ops_is_backlog_entity(entity_type,entity_id));

CREATE OR REPLACE FUNCTION public.ops_old_backlog() RETURNS TABLE(entity_type text,id uuid,property_id uuid,description text,ticket_type text,opened timestamptz,last_update timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.ops_backlog_manager() THEN RAISE EXCEPTION 'Only Operations leadership can open Old backlog.'; END IF;
 RETURN QUERY SELECT * FROM (
  SELECT 'ticket'::text,t.id,t.property_id,t.title,coalesce(w.name,'Other'),t.created_at,t.updated_at FROM public.tickets t LEFT JOIN public.work_types w ON w.id=t.work_type_id WHERE t.ops_backlog_at IS NOT NULL AND t.status NOT IN ('resolved','closed') AND t.archived_at IS NULL AND NOT t.is_demo
  UNION ALL SELECT 'routine',r.id,r.property_id,r.title,CASE WHEN r.title ~* '(lawn|landscap|yard|mow|irrigation|sprinkler)' THEN 'Lawn care review' ELSE 'Maintenance review' END,r.created_at,r.updated_at FROM public.routine_controls r WHERE r.ops_backlog_at IS NOT NULL AND r.ops_archived_at IS NULL AND r.status IN ('due','in_progress') AND NOT r.is_demo
  UNION ALL SELECT 'lead',l.id,l.booked_property_id,coalesce(l.subject,l.partner_name,'Direct booking request'),'Direct booking',l.created_at,l.updated_at FROM public.leads l WHERE l.ops_backlog_at IS NOT NULL AND l.ops_archived_at IS NULL AND l.outcome IS NULL AND l.stage NOT IN ('converted','lost') AND NOT l.is_demo
 ) b ORDER BY b.created_at,b.id;
END $$;
REVOKE ALL ON FUNCTION public.ops_old_backlog() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_old_backlog() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ops_backlog_action(_items jsonb,_action text,_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE item jsonb; ty text; eid uuid; before_row jsonb; after_row jsonb; r record; s public.guest_ready_standards; t public.tickets; rc public.routine_controls; l public.leads; _today date := (now() AT TIME ZONE 'America/Chicago')::date; _due date; n int:=0;
BEGIN
 IF NOT public.ops_backlog_manager() THEN RAISE EXCEPTION 'Only Operations leadership can change Old backlog.'; END IF;
 IF _action NOT IN ('close','live','archive') OR jsonb_typeof(_items)<>'array' OR jsonb_array_length(_items)<1 OR jsonb_array_length(_items)>1000 THEN RAISE EXCEPTION 'Choose items and an action.'; END IF;
 IF length(btrim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'Give a short reason.'; END IF;
 PERFORM set_config('resolve.ops_transition','on',true);
 PERFORM set_config('resolve.due_lock_reason_ok','on',true);
 FOR item IN SELECT value FROM jsonb_array_elements(_items) ORDER BY value->>'type',value->>'id' LOOP
  ty:=item->>'type';eid:=(item->>'id')::uuid;
  IF EXISTS(SELECT 1 FROM public.ops_backlog_history WHERE entity_type=ty AND entity_id=eid AND action=_action AND created_at>now()-interval '1 second') THEN CONTINUE; END IF;
  IF ty='ticket' THEN
   SELECT * INTO t FROM public.tickets WHERE id=eid FOR UPDATE;
   IF NOT FOUND OR t.ops_backlog_at IS NULL OR t.archived_at IS NOT NULL OR t.status IN ('resolved','closed') THEN RAISE EXCEPTION 'This backlog item changed. Refresh the list.'; END IF;
   before_row:=to_jsonb(t);
   IF _action='live' THEN
    s:=private.guest_ready_row(t.work_type_id,t.priority);
    _due:=CASE s.rule WHEN 'same_day' THEN _today WHEN 'clean_day_4pm' THEN _today WHEN 'days' THEN _today+coalesce(s.rule_days,7) ELSE CASE WHEN t.priority IN ('p1','p2') THEN _today ELSE _today+7 END END;
    SELECT * INTO r FROM public.ticket_route_at(CASE WHEN t.functional_role_code LIKE 'ge\_%' OR EXISTS(SELECT 1 FROM public.work_types WHERE id=t.work_type_id AND name='Arrival check') THEN 'ge_day' ELSE 'po_day' END,NULL,now());
    UPDATE public.tickets SET ops_backlog_at=NULL,ops_live_at=now(),ops_assigned_at=now(),due_on=_due,due_locked=coalesce(s.locked,false),response_due_at=now()+make_interval(mins=>coalesce((SELECT response_minutes FROM public.work_types WHERE id=t.work_type_id),CASE WHEN t.priority='p1' THEN 3 WHEN t.priority='p2' THEN 30 ELSE 1440 END)),action_due_at=now()+make_interval(mins=>coalesce((SELECT action_start_minutes FROM public.work_types WHERE id=t.work_type_id),CASE WHEN t.priority='p1' THEN 5 WHEN t.priority='p2' THEN 60 ELSE 2880 END)),due_at=(_due+time '17:00') AT TIME ZONE 'America/Chicago',next_action_due_at=(_due+time '17:00') AT TIME ZONE 'America/Chicago',acknowledged_at=NULL,action_started_at=NULL,next_review_at=NULL,promised_update_due_at=NULL,status='open',waiting_on=NULL,waiting_reason=NULL,assigned_to=r.user_id,current_action_owner=r.user_id,assignment_source=r.source,assignment_note=r.note,escalated_at=NULL,escalation_level='none',unowned_since=CASE WHEN r.user_id IS NULL THEN now() ELSE NULL END,external_status=CASE WHEN external_source='notion' THEN 'reopened_in_resolve' ELSE external_status END,import_hold=NULL WHERE id=eid;
   ELSIF _action='close' THEN
    UPDATE public.tickets SET status='closed',resolved_at=now(),resolution_notes=_reason,closure_exception_reason=_reason,closure_exception_by=auth.uid(),closure_exception_at=now() WHERE id=eid;
   ELSE
    UPDATE public.tickets SET archived_at=now(),archive_reason=_reason,archived_by=auth.uid() WHERE id=eid;
   END IF;
   SELECT to_jsonb(x) INTO after_row FROM public.tickets x WHERE id=eid;
   INSERT INTO public.ticket_activity(ticket_id,author_id,kind,event_type,body,internal,is_demo) VALUES(eid,auth.uid(),'status','old_backlog_'||_action,CASE _action WHEN 'live' THEN 'Moved to live work. ' WHEN 'close' THEN 'Closed. ' ELSE 'Archived. ' END||_reason,true,t.is_demo);
  ELSIF ty='routine' THEN
   SELECT * INTO rc FROM public.routine_controls WHERE id=eid FOR UPDATE;
   IF NOT FOUND OR rc.ops_backlog_at IS NULL OR rc.ops_archived_at IS NOT NULL OR rc.status NOT IN ('due','in_progress') THEN RAISE EXCEPTION 'This backlog item changed. Refresh the list.'; END IF;
   before_row:=to_jsonb(rc);
   IF _action='live' THEN
    SELECT * INTO r FROM public.ticket_route_at('po_day',NULL,now());
    SELECT * INTO s FROM public.guest_ready_standards WHERE label ILIKE CASE WHEN rc.title ~* '(lawn|landscap|yard|mow|irrigation|sprinkler)' THEN '%lawn%' ELSE '%maintenance%' END ORDER BY sort_order LIMIT 1;
    _due:=CASE s.rule WHEN 'days' THEN _today+coalesce(s.rule_days,7) WHEN 'same_day' THEN _today ELSE _today+1 END;
    UPDATE public.routine_controls SET ops_backlog_at=NULL,ops_live_at=now(),ops_assigned_at=now(),due_at=(_due+time '17:00') AT TIME ZONE 'America/Chicago',assigned_to=r.user_id,assigned_role_code=r.role_code WHERE id=eid;
   ELSIF _action='close' THEN UPDATE public.routine_controls SET status='completed',notes=concat_ws(E'\n',notes,_reason),completed_by=auth.uid() WHERE id=eid;
   ELSE UPDATE public.routine_controls SET ops_archived_at=now(),notes=concat_ws(E'\n',notes,_reason) WHERE id=eid;
   END IF;
   SELECT to_jsonb(x) INTO after_row FROM public.routine_controls x WHERE id=eid;
  ELSIF ty='lead' THEN
   SELECT * INTO l FROM public.leads WHERE id=eid FOR UPDATE;
   IF NOT FOUND OR l.ops_backlog_at IS NULL OR l.ops_archived_at IS NOT NULL OR l.outcome IS NOT NULL OR l.stage IN ('converted','lost') THEN RAISE EXCEPTION 'This backlog item changed. Refresh the list.'; END IF;
   before_row:=to_jsonb(l);
   IF _action='live' THEN
    SELECT * INTO r FROM public.ticket_route_at('ge_day',NULL,now());
    UPDATE public.leads SET ops_backlog_at=NULL,ops_live_at=now(),assigned_to=r.user_id,owned_by=r.user_id,started_at=now(),follow_up_due_at=now()+interval '48 hours',overnight_until=NULL WHERE id=eid;
   ELSIF _action='close' THEN UPDATE public.leads SET stage='lost',outcome='not_booked',outcome_at=now(),outcome_by=auth.uid(),not_booked_reason='other',not_booked_note=_reason,lost_note=_reason WHERE id=eid;
   ELSE UPDATE public.leads SET ops_archived_at=now(),notes=concat_ws(E'\n',notes,_reason) WHERE id=eid;
   END IF;
   SELECT to_jsonb(x) INTO after_row FROM public.leads x WHERE id=eid;
  ELSE RAISE EXCEPTION 'Unknown backlog item.';
  END IF;
  INSERT INTO public.ops_backlog_history(entity_type,entity_id,action,reason,actor_id,before_value,after_value) VALUES(ty,eid,_action,_reason,auth.uid(),before_row,after_row);
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value) VALUES(auth.uid(),'ops_backlog_'||_action,ty,eid,_reason,before_row,after_row);
  n:=n+1;
 END LOOP;
 PERFORM set_config('resolve.ops_transition','',true);
 PERFORM set_config('resolve.due_lock_reason_ok','',true);
 RETURN jsonb_build_object('changed',n);
END $$;
REVOKE ALL ON FUNCTION public.ops_backlog_action(jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_backlog_action(jsonb,text,text) TO authenticated,service_role;

INSERT INTO public.ops_assignment_batch(id,run_at) VALUES('ops-simplification','2026-11-26 14:00:00+00');
INSERT INTO public.ops_assignment_batch_items SELECT 'ops-simplification','ticket',id FROM public.tickets WHERE ops_backlog_at IS NULL AND status NOT IN ('resolved','closed') AND archived_at IS NULL AND assigned_to IS NULL AND current_action_owner IS NULL AND NOT is_demo;
INSERT INTO public.ops_assignment_batch_items SELECT 'ops-simplification','routine',id FROM public.routine_controls WHERE ops_backlog_at IS NULL AND kind='maintenance_review' AND status IN ('due','in_progress') AND assigned_to IS NULL AND NOT is_demo;
CREATE OR REPLACE FUNCTION public.ops_assign_pending_once() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE b public.ops_assignment_batch; i record; t public.tickets; rc public.routine_controls; r record; n int:=0;
BEGIN
 SELECT * INTO b FROM public.ops_assignment_batch WHERE id='ops-simplification' FOR UPDATE;
 IF NOT FOUND OR b.finished_at IS NOT NULL OR now()<b.run_at THEN RETURN jsonb_build_object('assigned',0); END IF;
 FOR i IN SELECT x.* FROM public.ops_assignment_batch_items x LEFT JOIN public.tickets t ON x.entity_type='ticket' AND t.id=x.entity_id LEFT JOIN public.routine_controls rc ON x.entity_type='routine' AND rc.id=x.entity_id WHERE x.batch_id=b.id ORDER BY coalesce(t.created_at,rc.created_at),x.entity_type,x.entity_id LOOP
  IF i.entity_type='ticket' THEN
   SELECT * INTO t FROM public.tickets WHERE id=i.entity_id FOR UPDATE;
   IF t.ops_backlog_at IS NOT NULL OR t.archived_at IS NOT NULL OR t.status IN ('resolved','closed') OR t.assigned_to IS NOT NULL OR t.current_action_owner IS NOT NULL THEN CONTINUE; END IF;
   SELECT * INTO r FROM public.ticket_route_at(CASE WHEN t.functional_role_code LIKE 'ge\_%' OR EXISTS(SELECT 1 FROM public.work_types WHERE id=t.work_type_id AND name='Arrival check') THEN 'ge_day' ELSE 'po_day' END,NULL,now());
   UPDATE public.tickets SET assigned_to=r.user_id,current_action_owner=r.user_id,assignment_source=r.source,assignment_note=r.note,ops_assigned_at=now() WHERE id=t.id;
  ELSE
   SELECT * INTO rc FROM public.routine_controls WHERE id=i.entity_id FOR UPDATE;
   IF rc.ops_backlog_at IS NOT NULL OR rc.ops_archived_at IS NOT NULL OR rc.status NOT IN ('due','in_progress') OR rc.assigned_to IS NOT NULL THEN CONTINUE; END IF;
   SELECT * INTO r FROM public.ticket_route_at('po_day',NULL,now());
   UPDATE public.routine_controls SET assigned_to=r.user_id,assigned_role_code=r.role_code,ops_assigned_at=now() WHERE id=rc.id;
  END IF;
  IF r.user_id IS NOT NULL THEN n:=n+1; END IF;
 END LOOP;
 UPDATE public.ops_assignment_batch SET finished_at=now(),result=jsonb_build_object('assigned',n) WHERE id=b.id;
 RETURN jsonb_build_object('assigned',n);
END $$;
REVOKE ALL ON FUNCTION public.ops_assign_pending_once() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_assign_pending_once() TO service_role;
-- SQL-only scheduled assignment, one receipt, no HTTP integration or switch change.
SELECT cron.schedule('ops-simplification-assign-once','0 14 26 11 *',$job$SELECT public.ops_assign_pending_once(); SELECT cron.unschedule('ops-simplification-assign-once');$job$);
