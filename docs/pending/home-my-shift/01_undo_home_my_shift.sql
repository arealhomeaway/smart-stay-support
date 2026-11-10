-- Undo for 01_home_my_shift.sql. Roll the app code back first.
-- Restores run_ticket_timed_alerts exactly as captured live (live-capture/), puts
-- the alert kinds back, removes the five new functions and the two new tables.
-- Handoffs created by End my shift stay: they are ordinary handoffs and keep
-- their Accept and Decline. The 15 minute alert lines already sent stay too.

DROP FUNCTION IF EXISTS public.decide_time_off(uuid, text, text);
DROP FUNCTION IF EXISTS public.request_time_off(date, date, text, boolean);
DROP FUNCTION IF EXISTS public.end_my_shift(text, timestamptz, jsonb, boolean, boolean);
DROP FUNCTION IF EXISTS public.shift_handoff_defaults(timestamptz);

-- run_ticket_timed_alerts exactly as live-capture/public.run_ticket_timed_alerts.sql:
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

  RETURN _sent;
END;
$function$;

DELETE FROM public.ticket_timed_alerts WHERE kind IN ('handoff_receiver', 'handoff_supervisor');
ALTER TABLE public.ticket_timed_alerts DROP CONSTRAINT ticket_timed_alerts_kind_check;
ALTER TABLE public.ticket_timed_alerts ADD CONSTRAINT ticket_timed_alerts_kind_check
  CHECK (kind = ANY (ARRAY['team_queue_supervisor'::text, 'team_queue_director'::text, 'waiting_return'::text]));

DROP TABLE IF EXISTS public.time_off_requests;
DROP TABLE IF EXISTS public.shift_end_records;
