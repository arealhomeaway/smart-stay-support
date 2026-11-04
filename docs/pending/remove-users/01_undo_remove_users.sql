-- Undo for 01_remove_users.sql. Removes the functions and the delete guard.
-- The four profile columns are kept and marked retired, so no saved removal or archive
-- record is lost (dropping them would erase who was removed or archived and when).
DROP FUNCTION IF EXISTS public.set_account_archived(uuid, boolean);
DROP FUNCTION IF EXISTS public.remove_staff_user(uuid);
DROP FUNCTION IF EXISTS public.reassign_staff_open_work(uuid);
DROP FUNCTION IF EXISTS public.staff_open_work(uuid);
DROP TRIGGER IF EXISTS profiles_never_delete ON public.profiles;
DROP FUNCTION IF EXISTS public.block_profile_delete();
COMMENT ON COLUMN public.profiles.removed_at IS 'DEPRECATED: remove-users change undone';
COMMENT ON COLUMN public.profiles.archived_at IS 'DEPRECATED: remove-users change undone';
