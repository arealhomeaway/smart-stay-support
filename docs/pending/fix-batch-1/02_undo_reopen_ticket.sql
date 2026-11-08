-- Undo for 02_reopen_ticket.sql: removes the new reopen step. Nothing else used it
-- before this batch; the Notion reopen is untouched. History lines it wrote stay.
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

DROP FUNCTION IF EXISTS public.reopen_ticket(uuid, text, timestamptz, timestamptz);
