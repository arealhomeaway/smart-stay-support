-- Scorecard capture, part 4: archive instead of delete. Nobody can delete a ticket.
-- Reuses the existing tickets.archived_at, archived_by and archive_reason columns.
-- No BEGIN/COMMIT.

-- Remove the only delete path in the database (Admin and Supervisor could delete).
DROP POLICY IF EXISTS tickets_delete_admin ON public.tickets;
REVOKE DELETE ON public.tickets FROM authenticated, anon;

CREATE OR REPLACE FUNCTION private.refuse_ticket_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tickets are never deleted. Archive it instead.' USING ERRCODE = 'P0001';
END $$;
CREATE TRIGGER tickets_never_delete BEFORE DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.refuse_ticket_delete();
CREATE TRIGGER tickets_never_truncate BEFORE TRUNCATE ON public.tickets
  FOR EACH STATEMENT EXECUTE FUNCTION private.refuse_ticket_delete();

-- Archive: Admin or a Supervisor, with a reason. Hides it from lists and counts; history stays.
CREATE OR REPLACE FUNCTION public.archive_ticket(_ticket_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _t record;
  _why text := btrim(coalesce(_reason, ''));
BEGIN
  IF _me IS NULL OR NOT (private.is_supervisor(_me) OR private.sc_is_ops_supervisor(_me)) THEN
    RAISE EXCEPTION 'Only an Admin or a Supervisor can archive a ticket.';
  END IF;
  IF length(_why) < 3 OR length(_why) > 500 THEN
    RAISE EXCEPTION 'Give a short reason for archiving.';
  END IF;
  SELECT id, archived_at, is_demo INTO _t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This ticket was not found.'; END IF;
  IF _t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This ticket is already archived.'; END IF;
  UPDATE public.tickets SET archived_at = now(), archived_by = _me, archive_reason = _why WHERE id = _ticket_id;
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
  VALUES (_ticket_id, _me, 'status', 'archived', 'Archived. Reason: ' || _why, true, coalesce(_t.is_demo, false));
  RETURN jsonb_build_object('ticket_id', _ticket_id, 'archived', true);
END $$;

-- Restore: Admin only. The archive line and its reason stay in the history.
CREATE OR REPLACE FUNCTION public.restore_ticket(_ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _t record;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can restore a ticket.';
  END IF;
  SELECT id, archived_at, is_demo INTO _t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This ticket was not found.'; END IF;
  IF _t.archived_at IS NULL THEN RAISE EXCEPTION 'This ticket is not archived.'; END IF;
  UPDATE public.tickets SET archived_at = NULL, archived_by = NULL, archive_reason = NULL WHERE id = _ticket_id;
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
  VALUES (_ticket_id, _me, 'status', 'restored', 'Restored by an Admin.', true, coalesce(_t.is_demo, false));
  RETURN jsonb_build_object('ticket_id', _ticket_id, 'archived', false);
END $$;

REVOKE ALL ON FUNCTION public.archive_ticket(uuid, text), public.restore_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_ticket(uuid, text), public.restore_ticket(uuid) TO authenticated;
