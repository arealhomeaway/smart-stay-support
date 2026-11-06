-- Restores the previous rule: a vendor named on any Ticket for the home can read it.
DROP POLICY properties_select ON public.properties;
CREATE POLICY properties_select ON public.properties FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) OR (EXISTS (SELECT 1 FROM public.tickets t WHERE t.property_id = properties.id AND t.vendor_user_id = auth.uid())));
DROP FUNCTION IF EXISTS private.vendor_sees_property(uuid, uuid);
