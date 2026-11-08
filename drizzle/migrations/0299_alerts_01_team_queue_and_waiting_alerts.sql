-- lovable-cron-fallback-reviewed: Emily asked for a check every minute (1,440 runs a day) so Right now tickets nobody has taken and waiting tickets reach people on time with no screen open.
-- Alerts and approvals, part 1 (Emily, Nov 7, 2026; punch list Team Queue alert timing; register T2, T6, H5).
-- Undo: 01_undo_team_queue_and_waiting_alerts.sql. No BEGIN/COMMIT. Needs pg_cron (installed).
--
-- 1. tickets.unowned_since: when a ticket last started waiting for an owner. Set by a trigger when
--    a ticket is created with no owner or given back; cleared when someone takes it. When someone
--    takes it, the response and work start clocks that have not been met move forward by the time
--    it waited, so waiting for an owner never counts against the person who takes it.
-- 2. ticket_timed_alerts: one row per alert sent by the minute check (who, which ticket, which
--    wait or return time). The unique key is what makes every alert fire once.
-- 3. run_ticket_timed_alerts(), every minute:
--    a. A Right now ticket nobody has taken (open, not waiting, not archived, not demo, not a quiet
--       Notion import): the Operations Supervisor at 10 minutes, the Director of Operations at 15,
--       once each per wait, in app and email. Minutes come from the Team Queue timing setting.
--    b. A waiting ticket whose return time has come: its owner, once per return time, in app and email.
-- 4. notify_ticket_flow_events: the "Back from waiting" alert no longer fires when the status
--    changes (it now fires at the return time, 3b). Everything else is byte-identical to the live capture.

ALTER TABLE public.tickets ADD COLUMN unowned_since timestamptz;
COMMENT ON COLUMN public.tickets.unowned_since IS
  'When this ticket last started waiting for an owner (created with no owner or given back). Null while someone owns it. Read by the Team Queue and the minute alert check.';

-- Backfill: open tickets nobody owns today wait from when they arrived. Quiet Notion imports stay null.
SELECT set_config('resolve.import_quiet', 'on', true);
UPDATE public.tickets
   SET unowned_since = coalesce(reported_at, created_at)
 WHERE assigned_to IS NULL
   AND archived_at IS NULL
   AND status IN ('open','dispatched','in_progress','waiting','awaiting_guest')
   AND NOT (coalesce(external_source, '') = 'notion' AND external_status IS DISTINCT FROM 'reopened_in_resolve');
SELECT set_config('resolve.import_quiet', '', true);

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
$function$;
REVOKE ALL ON FUNCTION private.ticket_owner_wait_clock() FROM PUBLIC;

CREATE TRIGGER tickets_owner_wait_clock
  BEFORE INSERT OR UPDATE OF assigned_to ON public.tickets
  FOR EACH ROW
  WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on')
  EXECUTE FUNCTION private.ticket_owner_wait_clock();

CREATE TABLE public.ticket_timed_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('team_queue_supervisor', 'team_queue_director', 'waiting_return')),
  episode_at timestamptz NOT NULL,
  recipient uuid,
  notification_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_timed_alerts_once UNIQUE (ticket_id, kind, episode_at)
);
COMMENT ON TABLE public.ticket_timed_alerts IS
  'One row per alert sent by run_ticket_timed_alerts. episode_at is the wait start (Team Queue) or the return time (waiting). Written only by the minute check.';

GRANT SELECT ON public.ticket_timed_alerts TO authenticated;
GRANT ALL ON public.ticket_timed_alerts TO service_role;
ALTER TABLE public.ticket_timed_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read ticket timed alerts" ON public.ticket_timed_alerts
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

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
REVOKE ALL ON FUNCTION public.run_ticket_timed_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_ticket_timed_alerts() TO service_role;

CREATE OR REPLACE FUNCTION public.notify_ticket_flow_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _link text := '/tickets/' || NEW.id::text;
  _ref text := coalesce('#' || NEW.ref::text || ' ', '');
  _supervisor uuid;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Back from waiting fires at the return time the person set (run_ticket_timed_alerts), not here.

  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    _supervisor := public.seat_holder_at('ops_supervisor', now());
    IF _supervisor IS NOT NULL THEN
      PERFORM public.notify_staff(
        _supervisor, 'closure_qa',
        'Closure QA: ' || _ref || NEW.title,
        'This ticket is resolved and waiting on closure QA before it can be closed.',
        'ticket', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

SELECT cron.schedule(
  'ticket-timed-alerts',
  '* * * * *',
  $$SELECT public.run_ticket_timed_alerts()$$
);
