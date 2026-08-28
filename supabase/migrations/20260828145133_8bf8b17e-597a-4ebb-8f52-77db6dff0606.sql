DROP POLICY "Staff read onboarding tasks" ON public.onboarding_tasks;

CREATE POLICY "Staff read onboarding tasks"
ON public.onboarding_tasks FOR SELECT TO authenticated
USING (
  private.is_staff(auth.uid())
  OR (private.owner_sees_property(auth.uid(), property_id) AND requires_owner_approval IS TRUE)
);