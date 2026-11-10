-- Undo for 01-one-switch.sql: puts back set_email_intake exactly as the safety batch (0314) made it.
-- After undo the switch no longer starts or stops the timed check; turn the timed check by hand as
-- in docs/pending/email-intake-safety/README.md. Switch history rows are records and stay.
-- If the switch is on when you undo, turn it off first so the timed check is not left running.

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

