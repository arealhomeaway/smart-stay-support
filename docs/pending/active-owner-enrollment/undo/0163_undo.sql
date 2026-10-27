-- Undo for 0163_program_activity_release.sql.
-- The function was new (no prior version existed), so undo is a plain drop.
-- Run only if 0163 must be reverted; the release button will then show an error until code is rolled back.
DROP FUNCTION IF EXISTS public.release_owner_program_activities(uuid, uuid, boolean, int);
