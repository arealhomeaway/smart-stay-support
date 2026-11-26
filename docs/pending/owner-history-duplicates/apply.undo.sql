-- Safe undo: stop new duplicate archives. Never delete or unarchive owner entries.
-- The archive columns and reader exclusions remain so every earlier owner choice and audit record stays truthful.
REVOKE ALL ON FUNCTION public.archive_owner_duplicate_time_entry(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.archive_owner_duplicate_time_entry(uuid) IS 'DISABLED by safe undo: execution revoked; archived owner entries and audit history retained.';
