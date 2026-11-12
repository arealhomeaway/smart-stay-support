-- Undo for 01_owner_outside_notes.sql: removes the new reader. Nothing else changes; owner cards
-- fall back to owner_outside_resolve_lines and the default wording with "document".
DROP FUNCTION IF EXISTS public.owner_outside_resolve_notes(uuid);
NOTIFY pgrst, 'reload schema';
