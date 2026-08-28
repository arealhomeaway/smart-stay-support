CREATE POLICY "Staff withdraw pending onboarding approvals"
ON public.approvals
FOR UPDATE
TO authenticated
USING (
  private.is_staff(auth.uid())
  AND status = 'pending'
  AND entity_type = 'onboarding_task'
)
WITH CHECK (
  private.is_staff(auth.uid())
  AND entity_type = 'onboarding_task'
  AND status IN ('pending', 'withdrawn')
);