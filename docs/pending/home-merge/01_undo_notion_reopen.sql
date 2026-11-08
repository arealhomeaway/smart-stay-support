-- Undo for 01_notion_reopen.sql. Removes only what that file added.
-- Tickets already reopened keep their Resolve values and history lines.
DROP TRIGGER IF EXISTS tickets_keep_reopened_notion ON public.tickets;
DROP FUNCTION IF EXISTS public.keep_reopened_notion_ticket();
DROP FUNCTION IF EXISTS public.reopen_notion_ticket(uuid, text, timestamptz, timestamptz);
