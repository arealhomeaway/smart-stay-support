-- Email intake safety batch (Emily, Nov 9). Additive only.
-- The email_intake switch stays OFF and the timed sweep job stays inactive.

-- 1. The switch only changes through set_email_intake, so the start line always moves with it.
CREATE OR REPLACE FUNCTION private.guard_email_intake_switch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'email_intake'
     AND ((TG_OP = 'INSERT' AND NEW.enabled)
          OR (TG_OP = 'UPDATE' AND NEW.enabled IS DISTINCT FROM OLD.enabled))
     AND coalesce(current_setting('resolve.email_intake_switch', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Email intake can only be turned on or off with its own switch, so the start line moves with it.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS feature_flags_email_intake_guard ON public.feature_flags;
CREATE TRIGGER feature_flags_email_intake_guard
  BEFORE INSERT OR UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION private.guard_email_intake_switch();

-- 2. Turning it on moves the start line to that moment (forward only). Off leaves it. Who and when are recorded.
CREATE OR REPLACE FUNCTION public.set_email_intake(_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _was boolean;
  _cp_id uuid;
  _before text;
  _after text;
  _line timestamptz := date_trunc('second', clock_timestamp()) + interval '1 second';
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can turn email intake on or off.';
  END IF;
  IF _enabled IS NULL THEN
    RAISE EXCEPTION 'Choose on or off.';
  END IF;
  SELECT enabled INTO _was FROM public.feature_flags WHERE key = 'email_intake' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The email intake switch was not found.';
  END IF;
  SELECT id, external_id INTO _cp_id, _before
    FROM public.integration_events
   WHERE system = 'outlook_inbox' AND operation = 'processing_checkpoint'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;
  _after := _before;
  IF _was = _enabled THEN
    RETURN jsonb_build_object('enabled', _was, 'changed', false, 'start_line', _before);
  END IF;
  IF _enabled AND (_before IS NULL OR _before::timestamptz < _line) THEN
    _after := to_char(_line AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    IF _cp_id IS NULL THEN
      INSERT INTO public.integration_events (system, direction, operation, external_id, status, resolved_at)
      VALUES ('outlook_inbox', 'inbound', 'processing_checkpoint', _after, 'checkpoint', now());
    ELSE
      UPDATE public.integration_events SET external_id = _after, resolved_at = now() WHERE id = _cp_id;
    END IF;
  END IF;
  PERFORM set_config('resolve.email_intake_switch', 'on', true);
  UPDATE public.feature_flags
     SET enabled = _enabled, updated_by = _me, updated_at = now()
   WHERE key = 'email_intake';
  PERFORM set_config('resolve.email_intake_switch', '', true);
  INSERT INTO public.integration_events
    (system, direction, operation, status, resolved_by, resolved_at, previous_value, request_payload)
  VALUES ('outlook_inbox', 'inbound', 'email_intake_switch',
          CASE WHEN _enabled THEN 'on' ELSE 'off' END, _me, now(),
          jsonb_build_object('enabled', _was, 'start_line', _before),
          jsonb_build_object('enabled', _enabled, 'start_line', _after));
  RETURN jsonb_build_object('enabled', _enabled, 'changed', true, 'start_line', _after);
END $$;

REVOKE ALL ON FUNCTION public.set_email_intake(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_email_intake(boolean) TO authenticated, service_role;

-- 3. The inbox panel reads whether the timed sweep job is running (staff only).
CREATE OR REPLACE FUNCTION public.email_intake_sweep_job()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _r jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_staff(auth.uid()) THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object('active', j.active, 'schedule', j.schedule) INTO _r
    FROM cron.job j WHERE j.jobname = 'resolve-mailbox-sync' LIMIT 1;
  RETURN _r;
END $$;

REVOKE ALL ON FUNCTION public.email_intake_sweep_job() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_intake_sweep_job() TO authenticated, service_role;

-- 4. Alerts about an email test record start with "Test: " (routing still fires).
CREATE OR REPLACE FUNCTION private.prefix_email_test_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.is_demo, false) AND NEW.entity_id IS NOT NULL
     AND coalesce(NEW.title, '') !~* '^test\M'
     AND ((NEW.entity_type = 'lead' AND EXISTS (
            SELECT 1 FROM public.leads l
             WHERE l.id = NEW.entity_id AND l.is_demo
               AND coalesce(l.source_detail ->> 'email_test', '') = 'true'))
       OR (NEW.entity_type = 'ticket' AND EXISTS (
            SELECT 1 FROM public.tickets t
             WHERE t.id = NEW.entity_id AND t.is_demo
               AND lower(coalesce(t.external_source, '')) = 'email'))) THEN
    NEW.title := 'Test: ' || coalesce(NEW.title, '');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS staff_notifications_email_test_prefix ON public.staff_notifications;
CREATE TRIGGER staff_notifications_email_test_prefix
  BEFORE INSERT ON public.staff_notifications
  FOR EACH ROW EXECUTE FUNCTION private.prefix_email_test_alert();

-- 5. Admin only: Clear test records.
CREATE OR REPLACE FUNCTION public.clear_email_intake_test_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _t record;
  _tickets integer := 0;
  _requests integer := 0;
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can clear email test records.';
  END IF;
  FOR _t IN
    SELECT id FROM public.tickets
     WHERE is_demo AND lower(coalesce(external_source, '')) = 'email' AND archived_at IS NULL
     ORDER BY created_at
  LOOP
    PERFORM public.archive_ticket(_t.id, 'Email intake test');
    _tickets := _tickets + 1;
  END LOOP;
  WITH closed AS (
    UPDATE public.leads
       SET outcome = 'not_booked', outcome_at = now(), outcome_by = _me,
           not_booked_reason = 'Other', not_booked_note = 'Email intake test',
           stage = 'lost', lost_at = now(), lost_note = 'Email intake test', updated_at = now()
     WHERE is_demo AND coalesce(source_detail ->> 'email_test', '') = 'true'
       AND outcome IS DISTINCT FROM 'not_booked'
    RETURNING id
  ), logged AS (
    INSERT INTO public.lead_activity (lead_id, channel, outcome, note, to_stage, actor_id)
    SELECT id, 'system', 'Not booked', 'Email intake test. Closed as Not booked (Other) by Clear test records.', 'lost', _me
      FROM closed
    RETURNING 1
  )
  SELECT count(*) INTO _requests FROM logged;
  INSERT INTO public.integration_events (system, direction, operation, status, resolved_by, resolved_at, request_payload)
  VALUES ('outlook_inbox', 'inbound', 'test_records_cleared', 'done', _me, now(),
          jsonb_build_object('tickets', _tickets, 'requests', _requests));
  RETURN jsonb_build_object('tickets', _tickets, 'requests', _requests);
END $$;

REVOKE ALL ON FUNCTION public.clear_email_intake_test_records() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_email_intake_test_records() TO authenticated, service_role;

-- 6. Timed sweep every minute with the private scheduler token. Stays inactive, and while the
--    switch is off the job makes no call at all. The old job is kept for undo.
CREATE TABLE IF NOT EXISTS private.email_intake_safety_undo (
  id integer PRIMARY KEY,
  job jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.email_intake_safety_undo FROM PUBLIC, anon, authenticated;

INSERT INTO private.email_intake_safety_undo (id, job)
SELECT 1, jsonb_build_object('schedule', schedule, 'command', command, 'active', active)
  FROM cron.job WHERE jobname = 'resolve-mailbox-sync'
ON CONFLICT (id) DO NOTHING;

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'resolve-mailbox-sync'),
  schedule := '* * * * *',
  command := $cmd$
  SELECT net.http_post(
    url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/sync/mailbox',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
      (SELECT token FROM private.cleaner_cron_token WHERE id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000)
  WHERE EXISTS (SELECT 1 FROM public.feature_flags WHERE key = 'email_intake' AND enabled);
  $cmd$,
  active := false);
