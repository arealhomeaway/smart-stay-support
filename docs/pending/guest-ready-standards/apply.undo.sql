-- Undo guest-ready-standards. Restores ticket-due-date's rules exactly; the table is kept, renamed, never emptied.
DROP TRIGGER IF EXISTS tickets_due_lock_guard ON public.tickets;
DROP FUNCTION IF EXISTS private.ticket_due_lock_guard();
DROP FUNCTION IF EXISTS public.save_guest_ready_standard(uuid, text, text, boolean, text, int, uuid, text);
DROP FUNCTION IF EXISTS public.set_ticket_due_on(uuid, date, text);
-- (then re-run the set_ticket_due_on(uuid, date) and private.ticket_due_on_default() blocks from
--  docs/pending/ticket-due-date/apply.sql, copied below unchanged)
CREATE OR REPLACE FUNCTION private.ticket_due_on_default()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.due_on IS NULL THEN
    NEW.due_on := CASE lower(coalesce(NEW.priority, ''))
      WHEN 'p1' THEN (now() AT TIME ZONE 'America/Chicago')::date
      WHEN 'p2' THEN (now() AT TIME ZONE 'America/Chicago')::date
      WHEN 'p3' THEN (now() AT TIME ZONE 'America/Chicago')::date + 7
      ELSE NULL END;
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.set_ticket_due_on(_ticket_id uuid, _due_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _old date;
  _found boolean;
  _year text := to_char((now() AT TIME ZONE 'America/Chicago')::date, 'YYYY');
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Sign in to change the due date.'; END IF;
  IF _due_on IS NULL THEN RAISE EXCEPTION 'Pick a date.'; END IF;
  SELECT true, due_on INTO _found, _old FROM public.tickets WHERE id = _ticket_id;
  IF _found IS NULL THEN RAISE EXCEPTION 'That ticket could not be found.'; END IF;
  IF _old IS NOT DISTINCT FROM _due_on THEN
    RETURN jsonb_build_object('changed', false, 'due_on', _due_on);
  END IF;
  -- The caller's own access rules decide: only people who can edit this ticket change it.
  UPDATE public.tickets SET due_on = _due_on WHERE id = _ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'You cannot change this ticket.'; END IF;
  INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, internal, body)
  VALUES (_ticket_id, _actor, 'status', 'due_date_changed', false,
    CASE WHEN _old IS NULL THEN 'Due date set to ' ELSE 'Due date changed from '
      || to_char(_old, 'Mon FMDD') || CASE WHEN to_char(_old, 'YYYY') <> _year THEN to_char(_old, ', YYYY') ELSE '' END
      || ' to ' END
    || to_char(_due_on, 'Mon FMDD') || CASE WHEN to_char(_due_on, 'YYYY') <> _year THEN to_char(_due_on, ', YYYY') ELSE '' END);
  RETURN jsonb_build_object('changed', true, 'due_on', _due_on, 'previous', _old);
END $function$;

REVOKE ALL ON FUNCTION public.set_ticket_due_on(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ticket_due_on(uuid, date) TO authenticated, service_role;
DROP FUNCTION IF EXISTS private.guest_ready_row(uuid, text);
ALTER TABLE public.tickets DROP COLUMN IF EXISTS due_locked;
ALTER TABLE public.guest_ready_standards RENAME TO guest_ready_standards_retired;
COMMENT ON TABLE public.guest_ready_standards_retired IS 'DEPRECATED: guest-ready-standards undone; rows kept.';
