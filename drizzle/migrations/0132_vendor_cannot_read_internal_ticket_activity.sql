DROP POLICY IF EXISTS ticket_activity_select ON public.ticket_activity;
CREATE POLICY ticket_activity_select ON public.ticket_activity FOR SELECT TO authenticated
USING (private.is_staff(auth.uid()) OR (private.is_assigned_vendor(auth.uid(), ticket_id) AND NOT coalesce(internal, false)));