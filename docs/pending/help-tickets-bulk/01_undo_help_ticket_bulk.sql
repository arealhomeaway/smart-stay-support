BEGIN;
-- Export bulk receipts before undo if any real bulk saves were made.
DROP FUNCTION public.record_help_bulk_delivery(uuid,uuid[],text,text);
DROP FUNCTION public.claim_help_bulk_notifications(uuid);
DROP FUNCTION public.bulk_update_help_tickets(uuid,jsonb,text,text,boolean);
DROP TABLE public.help_ticket_bulk_updates;
-- Per-ticket status/history and email logs are intentionally retained.
COMMIT;
