-- Undo Build 9 B1. Tickets moved to the queue go back to quiet older imports (their history lines stay).
DROP FUNCTION IF EXISTS public.move_notion_to_queue(uuid[]);
UPDATE public.tickets SET import_hold = NULL WHERE import_hold = 'in_queue';
ALTER TABLE public.tickets DROP CONSTRAINT tickets_import_hold_chk;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_import_hold_chk
  CHECK (import_hold IS NULL OR import_hold = ANY (ARRAY['backlog_review'::text, 'needs_home'::text]));
