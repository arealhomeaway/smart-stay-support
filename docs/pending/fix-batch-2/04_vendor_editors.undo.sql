-- Undo 04: remove the vendor editor policies and helper. Existing Supervisor policies are untouched.
DROP POLICY IF EXISTS vendor_orgs_insert_editors ON public.vendor_orgs;
DROP POLICY IF EXISTS vendor_orgs_update_editors ON public.vendor_orgs;
DROP POLICY IF EXISTS service_areas_write_editors ON public.vendor_service_areas;
DROP POLICY IF EXISTS coverage_write_editors ON public.property_vendor_coverage;
DROP FUNCTION IF EXISTS public.can_edit_vendors(uuid);
