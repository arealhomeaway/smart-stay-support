-- Undo property-guidebook-link: remove the save function; the column is kept (additive rule) and marked retired.
DROP FUNCTION IF EXISTS public.set_property_guidebook_link(uuid, text);
COMMENT ON COLUMN public.properties.guidebook_url IS 'DEPRECATED: guidebook link retired by undo.';
