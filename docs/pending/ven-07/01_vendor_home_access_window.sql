-- VEN-07 exposure 2: a vendor may read a home only while they have an open
-- Ticket or Work Order there, or one closed in the last 30 days.
-- Precheck: the live properties_select policy must still be the old rule.
DO $pre$
DECLARE q text;
BEGIN
  SELECT regexp_replace(qual, '\s+', ' ', 'g') INTO q FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'properties' AND policyname = 'properties_select';
  IF q IS NULL OR q NOT LIKE '%private.is_staff(auth.uid())%' OR q NOT LIKE '%t.vendor_user_id = auth.uid()%' OR q LIKE '%vendor_sees_property%' THEN
    RAISE EXCEPTION 'VEN-07 precheck failed: properties_select is not the expected old rule (%)', q;
  END IF;
  IF to_regprocedure('private.is_vendor_member(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'VEN-07 precheck failed: private.is_vendor_member is missing';
  END IF;
END
$pre$;

CREATE OR REPLACE FUNCTION private.vendor_sees_property(_user_id uuid, _property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.property_id = _property_id AND t.vendor_user_id = _user_id
         AND t.archived_at IS NULL
         AND (t.status <> 'closed' OR COALESCE(t.resolved_at, t.updated_at) > now() - interval '30 days')
    ) OR EXISTS (
      SELECT 1 FROM public.work_orders w
       WHERE w.property_id = _property_id AND w.vendor_org_id IS NOT NULL
         AND private.is_vendor_member(_user_id, w.vendor_org_id)
         AND (w.closed_at IS NULL OR w.closed_at > now() - interval '30 days')
    )
$$;
REVOKE ALL ON FUNCTION private.vendor_sees_property(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vendor_sees_property(uuid, uuid) TO authenticated, service_role;

DROP POLICY properties_select ON public.properties;
CREATE POLICY properties_select ON public.properties FOR SELECT TO public
  USING (private.is_staff(auth.uid()) OR private.vendor_sees_property(auth.uid(), id));
