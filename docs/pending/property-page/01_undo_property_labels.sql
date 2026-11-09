-- Undo for 01_property_labels.sql. Run only if Emily asks to take labels back out.
-- Removes the new label tables and functions. No existing table is touched.
DROP FUNCTION IF EXISTS public.property_label_remove(uuid, uuid);
DROP FUNCTION IF EXISTS public.property_label_add(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.property_label_retire(uuid);
DROP FUNCTION IF EXISTS public.property_label_rename(uuid, text);
DROP FUNCTION IF EXISTS public.property_label_create(text);
DROP FUNCTION IF EXISTS public.my_home_profile_access();
DROP TABLE IF EXISTS public.property_label_events;
DROP TABLE IF EXISTS public.property_label_assignments;
DROP TABLE IF EXISTS public.property_labels;
DROP FUNCTION IF EXISTS private.block_property_label_event_change();
-- private.home_profile_editor and private.actor_label are also used by 02; drop them only after 02 is undone.
DROP FUNCTION IF EXISTS private.home_profile_editor(uuid);
DROP FUNCTION IF EXISTS private.actor_label(uuid);
