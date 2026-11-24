-- This rolls back the newly added capability only. It cannot undo an actual property deletion.
BEGIN;
DROP TRIGGER IF EXISTS property_delete_checked_action ON public.properties;
DROP FUNCTION IF EXISTS public.guard_onboarding_property_delete();
DROP FUNCTION IF EXISTS public.delete_onboarding_property(uuid,text,text);
DROP FUNCTION IF EXISTS public.check_onboarding_property_delete(uuid);
DROP FUNCTION IF EXISTS public.property_delete_scope(uuid);
DROP FUNCTION IF EXISTS public.property_delete_tables();
DROP FUNCTION IF EXISTS public.can_delete_onboarding_property();
COMMIT;
