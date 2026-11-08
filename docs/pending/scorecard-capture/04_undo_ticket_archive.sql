-- Undo for 04_ticket_archive.sql. Puts back the delete policy exactly as it was live on
-- Nov 8, 2026. No delete grant existed on public.tickets for anon, authenticated or
-- service_role that day, so none is restored. Archived tickets stay archived.
-- No BEGIN/COMMIT.

DROP FUNCTION IF EXISTS public.restore_ticket(uuid);
DROP FUNCTION IF EXISTS public.archive_ticket(uuid, text);
DROP TRIGGER IF EXISTS tickets_never_truncate ON public.tickets;
DROP TRIGGER IF EXISTS tickets_never_delete ON public.tickets;
DROP FUNCTION IF EXISTS private.refuse_ticket_delete();

CREATE POLICY tickets_delete_admin ON public.tickets
  FOR DELETE
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role));
