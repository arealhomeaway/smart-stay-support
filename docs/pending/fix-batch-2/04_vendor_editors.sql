-- Fix batch 2, item 4: the Director of Onboarding, Project Manager and Utilities roles
-- can edit vendor records: the vendor company (create and update), its service areas
-- and its home coverage. Design is not included.
-- Unchanged: vendor status changes, Gold Standard and compliance fields (still
-- protected by the vendor_orgs_guard trigger), screening results, documents, vendor
-- logins, imports, custom column definitions and saved views. Additive only.

CREATE OR REPLACE FUNCTION public.can_edit_vendors(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT private.is_supervisor(_user_id)
      OR public.is_onboarding_director(_user_id)
      OR public.holds_functional_role(_user_id, 'onboarding_project_manager')
      OR public.holds_functional_role(_user_id, 'project_manager')
      OR public.holds_functional_role(_user_id, 'utilities')
$function$;
REVOKE ALL ON FUNCTION public.can_edit_vendors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_vendors(uuid) TO authenticated, service_role;

CREATE POLICY vendor_orgs_insert_editors ON public.vendor_orgs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_vendors(auth.uid()));

CREATE POLICY vendor_orgs_update_editors ON public.vendor_orgs
  FOR UPDATE TO authenticated
  USING (public.can_edit_vendors(auth.uid()))
  WITH CHECK (public.can_edit_vendors(auth.uid()));

CREATE POLICY service_areas_write_editors ON public.vendor_service_areas
  FOR ALL TO authenticated
  USING (public.can_edit_vendors(auth.uid()))
  WITH CHECK (public.can_edit_vendors(auth.uid()));

CREATE POLICY coverage_write_editors ON public.property_vendor_coverage
  FOR ALL TO authenticated
  USING (public.can_edit_vendors(auth.uid()))
  WITH CHECK (public.can_edit_vendors(auth.uid()));
