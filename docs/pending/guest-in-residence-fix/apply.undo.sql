-- Undo for guest-in-residence-fix: default back to true, trigger removed, every ticket's prior
-- guest_in_residence and next_guest_update_at restored from the audit row. Triggers held.
DROP TRIGGER IF EXISTS tickets_no_guest_clock_when_done ON public.tickets;
DROP FUNCTION IF EXISTS public.ticket_no_guest_clock_when_done();
ALTER TABLE public.tickets ALTER COLUMN guest_in_residence SET DEFAULT true;
DO $undo$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  a jsonb; n int;
BEGIN
  SELECT before_value INTO a FROM public.audit_log WHERE action = 'guest_in_residence_fix.apply' ORDER BY created_at DESC LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'guest-in-residence-fix was not applied; nothing to undo.'; END IF;
  ALTER TABLE public.tickets DISABLE TRIGGER USER;
  UPDATE public.tickets t SET guest_in_residence = (r->>'guest_in_residence')::boolean,
         next_guest_update_at = nullif(r->>'next_guest_update_at', '')::timestamptz
    FROM jsonb_array_elements(a->'tickets') r WHERE t.id = (r->>'id')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.tickets ENABLE TRIGGER USER;
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'guest_in_residence_fix.undo', 'tickets', 'Guest in residence',
    'Undo of guest-in-residence-fix: default true again, prior values restored.', NULL, jsonb_build_object('restored', n));
END $undo$;
