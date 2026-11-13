-- Undo for Property page Part 3. Puts the captured live objects back exactly.
-- Files filed into the two new folders must be moved first, or the old check refuses them:
--   UPDATE public.documents SET category = NULL WHERE category IN ('agreement','estimate_invoice');
-- (Only with approval; that line clears the folder, the files themselves stay.)
DROP FUNCTION IF EXISTS public.move_home_file(uuid, text);
DROP FUNCTION IF EXISTS public.save_home_detail_field(uuid, text, text);
DROP FUNCTION IF EXISTS private.onboarding_home_team_member(uuid, uuid);
ALTER TABLE public.documents DROP CONSTRAINT documents_category_chk;
\i live-capture/documents_category_chk.sql
ALTER TABLE public.vendor_orgs DROP COLUMN IF EXISTS preferred_contact;
ALTER TABLE public.onboarding_projects DROP COLUMN IF EXISTS loa_status, DROP COLUMN IF EXISTS telegram_url;
\i live-capture/set_onboarding_project_stagers.sql
