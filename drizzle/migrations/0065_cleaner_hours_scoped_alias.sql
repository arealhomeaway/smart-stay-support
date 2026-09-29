CREATE OR REPLACE FUNCTION private.cleaner_recompute_scoped(_task bigint)
 RETURNS jsonb LANGUAGE sql SET search_path TO 'public' AS $$ SELECT private.cleaner_recompute_task(_task) $$;