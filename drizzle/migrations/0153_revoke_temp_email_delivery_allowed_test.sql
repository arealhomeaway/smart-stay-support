-- Removes the temporary test-only grant from the previous migration.
REVOKE EXECUTE ON FUNCTION public.email_delivery_allowed(text[],text,uuid,uuid,uuid) FROM supabase_read_only_user;