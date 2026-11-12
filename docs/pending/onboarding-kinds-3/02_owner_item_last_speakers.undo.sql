-- Undo for 02_owner_item_last_speakers.sql: removes the reader. The homeowner page falls back to
-- reading each item through the live owner_item_detail.
DROP FUNCTION IF EXISTS public.owner_item_last_speakers(uuid[]);
NOTIFY pgrst, 'reload schema';
