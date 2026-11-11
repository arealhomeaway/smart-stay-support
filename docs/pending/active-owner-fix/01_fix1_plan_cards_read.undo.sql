-- Undo Fix 1: take the permission away again (live before: postgres only).
REVOKE EXECUTE ON FUNCTION private.owner_current_property_for_actor(uuid, uuid, uuid) FROM authenticated;
