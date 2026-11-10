-- Email intake follow ups (Emily, Nov 9, register E1 (e)). One switch: turning email intake on
-- also starts the timed check, turning it off stops it, in the same database step, so there is
-- never a half on state. Replaces set_email_intake from the safety batch (0314); everything else
-- it did stays exactly the same (Admin only, start line forward only, who and when recorded).
-- Additive in behaviour: no table, column or policy changes. The switch stays off.

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
  _job_id bigint;
  _job_was boolean;
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
  SELECT j.jobid, j.active INTO _job_id, _job_was
    FROM cron.job j WHERE j.jobname = 'resolve-mailbox-sync' LIMIT 1;
  -- Never on without its timed check: refuse, and nothing changes.
  IF _enabled AND _job_id IS NULL THEN
    RAISE EXCEPTION 'The timed check was not found, so email intake stays off.';
  END IF;
  SELECT id, external_id INTO _cp_id, _before
    FROM public.integration_events
   WHERE system = 'outlook_inbox' AND operation = 'processing_checkpoint'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;
  _after := _before;

  IF _was = _enabled THEN
    -- Same switch position: only repair a timed check left out of step with it.
    IF _job_id IS NOT NULL AND _job_was IS DISTINCT FROM _enabled THEN
      PERFORM cron.alter_job(job_id := _job_id, active := _enabled);
      INSERT INTO public.integration_events
        (system, direction, operation, status, resolved_by, resolved_at, previous_value, request_payload)
      VALUES ('outlook_inbox', 'inbound', 'email_intake_timed_check',
              CASE WHEN _enabled THEN 'on' ELSE 'off' END, _me, now(),
              jsonb_build_object('timed_check', _job_was),
              jsonb_build_object('timed_check', _enabled, 'reason', 'matched to the switch'));
    END IF;
    RETURN jsonb_build_object('enabled', _was, 'changed', false, 'start_line', _before,
                              'timed_check', CASE WHEN _job_id IS NULL THEN false ELSE _enabled END);
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
  -- The timed check follows the switch in the same step.
  IF _job_id IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := _job_id, active := _enabled);
  END IF;
  INSERT INTO public.integration_events
    (system, direction, operation, status, resolved_by, resolved_at, previous_value, request_payload)
  VALUES ('outlook_inbox', 'inbound', 'email_intake_switch',
          CASE WHEN _enabled THEN 'on' ELSE 'off' END, _me, now(),
          jsonb_build_object('enabled', _was, 'start_line', _before, 'timed_check', coalesce(_job_was, false)),
          jsonb_build_object('enabled', _enabled, 'start_line', _after,
                             'timed_check', CASE WHEN _job_id IS NULL THEN false ELSE _enabled END));
  RETURN jsonb_build_object('enabled', _enabled, 'changed', true, 'start_line', _after,
                            'timed_check', CASE WHEN _job_id IS NULL THEN false ELSE _enabled END);
END $$;

REVOKE ALL ON FUNCTION public.set_email_intake(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_email_intake(boolean) TO authenticated, service_role;
