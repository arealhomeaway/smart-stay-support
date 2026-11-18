-- Undo for ticket-due-date. Removes the change, the default rule and the Due date column with its values.
-- History lines already written by set_ticket_due_on stay (history is add only).
DROP FUNCTION IF EXISTS public.set_ticket_due_on(uuid, date);
DROP TRIGGER IF EXISTS tickets_zz_due_on_default ON public.tickets;
DROP FUNCTION IF EXISTS private.ticket_due_on_default();
ALTER TABLE public.tickets DROP COLUMN IF EXISTS due_on;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ticket_due_date.undo', 'table', 'tickets',
  'Undo of ticket-due-date: Due date column, default rule and change function removed.');
