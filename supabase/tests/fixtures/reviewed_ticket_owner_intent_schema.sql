-- Local-only: mirror the service role's base operational table privileges.
GRANT SELECT,UPDATE ON tickets,properties,property_owners TO service_role;
-- Existing owner history policy uses the definer owns_program helper in the real schema.
-- The earlier minimal response fixture joined its RLS-protected program table directly.
ALTER POLICY owner_response_history ON owner_program_events USING(private.owns_program(auth.uid(),program_id));
