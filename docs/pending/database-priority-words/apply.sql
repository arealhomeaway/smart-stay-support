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
          'A P1 ticket has waited ' || _sup_min || ' minutes in the Team Queue with no owner. Give it to someone on shift or take it.',
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
            'A P1 ticket has waited ' || _dir_min || ' minutes in the Team Queue with no owner. The Operations Supervisor was alerted at ' || _sup_min || ' minutes.',
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
          'A P1 handoff has waited ' || _handoff_min || ' minutes. Accept it or decline it with a reason now.',
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
          'A P1 handoff has waited ' || _handoff_min || ' minutes and nobody has accepted it. Make sure someone has it.',
          'handoff', _t.handoff_id, '/tickets/' || _t.ticket_id::text, 'urgent', NULL, true, _t.is_demo)
        WHERE id = _log;
        _sent := _sent + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN _sent;
END;
$function$;
