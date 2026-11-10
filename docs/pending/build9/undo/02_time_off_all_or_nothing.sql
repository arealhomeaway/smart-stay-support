-- Undo Build 9 C2: remove the all or nothing approval. Rows it already saved stay as normal
-- time off and cover rows (they are the same rows the Add time off form saves).
DROP FUNCTION IF EXISTS public.approve_time_off(uuid, jsonb, text);
