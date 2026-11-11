-- Active Owner fix, Fix 1 (apply first, alone). Nov 11.
-- The read rules on ao_home_plan_cards (ao_plan_read) and ao_contributions (ao_contrib_read) call
-- private.owner_current_property_for_actor, which signed in users may not run, so every read of those
-- two tables fails with "permission denied for function owner_current_property_for_actor".
-- The function already runs as its owner and only answers yes or no. Nothing else changes:
-- both rules stay exactly as they are (staff read through is_internal_staff; an owner reads only
-- their own current homes).
GRANT EXECUTE ON FUNCTION private.owner_current_property_for_actor(uuid, uuid, uuid) TO authenticated;
