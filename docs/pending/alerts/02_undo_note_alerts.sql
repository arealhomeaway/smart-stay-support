-- Undo for 02_note_alerts.sql. No BEGIN/COMMIT. Notes and their saved mentions stay.
DROP TRIGGER ticket_activity_note_alerts ON public.ticket_activity;
DROP FUNCTION private.notify_ticket_note();
