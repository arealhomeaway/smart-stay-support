-- Undo for 02_home_profile_edits.sql. Run before 01's undo.
-- Values already saved onto homes stay as they are (nothing is rolled back on a home);
-- only the history table, the photo placement table and the save functions go.
DROP FUNCTION IF EXISTS public.remove_home_profile_photo(uuid);
DROP FUNCTION IF EXISTS public.add_home_profile_photo(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.save_home_profile_card(uuid, text, jsonb);
DROP TABLE IF EXISTS public.property_profile_photos;
DROP TABLE IF EXISTS public.property_profile_edits;
DROP FUNCTION IF EXISTS private.block_property_profile_edit_change();
