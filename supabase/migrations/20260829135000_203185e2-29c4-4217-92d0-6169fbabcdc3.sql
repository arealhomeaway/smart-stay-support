CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.owner_can_see_property(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_program_properties opp
    JOIN public.owner_programs p ON p.id = opp.program_id
    WHERE p.owner_user_id = _user_id
      AND opp.property_id = _property_id
      AND opp.inclusion_status = 'included'
      AND opp.archived_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION private.owner_can_see_property(uuid, uuid) FROM public;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owner_can_see_property(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "documents_read_owner_shared" ON public.documents;
CREATE POLICY "documents_read_owner_shared" ON public.documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND property_id IS NOT NULL
    AND (visibility = 'owner_shared' OR requested_from = 'owner')
    AND private.owner_can_see_property(auth.uid(), property_id)
  );

DROP FUNCTION IF EXISTS public.owner_can_see_property(uuid, uuid);