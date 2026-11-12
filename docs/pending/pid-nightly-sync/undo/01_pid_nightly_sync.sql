-- Undo for 01_pid_nightly_sync.sql. Removes the nightly PID copy's switch, tables and functions.
-- Values the copy already wrote to homes, source records, links and the code vault stay, as every
-- other import's do; this removes only the machinery. Turn the switch off before running.
DROP FUNCTION IF EXISTS public.pid_sync_apply_home(uuid, uuid, text, date, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.pid_sync_changed_since_copy();
DROP FUNCTION IF EXISTS private.pid_jsonb_set_deep(jsonb, text[], jsonb);
DROP TABLE IF EXISTS private.pid_sync_credential_links;
DROP TABLE IF EXISTS private.pid_sync_secret_fingerprints;
DROP TABLE IF EXISTS private.pid_sync_field_hashes;
DROP TABLE IF EXISTS public.property_pid_extra_fields;
DROP TABLE IF EXISTS public.pid_sync_review_items;
DELETE FROM public.feature_flags WHERE key = 'pid_nightly_sync';
