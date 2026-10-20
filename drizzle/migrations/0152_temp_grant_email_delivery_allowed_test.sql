-- TEMPORARY test-only grant (Emily approved Oct 20); revoked in the next migration.
GRANT EXECUTE ON FUNCTION public.email_delivery_allowed(text[],text,uuid,uuid,uuid) TO supabase_read_only_user;