ALTER TABLE public.properties ALTER COLUMN lifecycle_status SET DEFAULT 'not_onboarded';

UPDATE public.properties p
SET lifecycle_status = 'not_onboarded'
WHERE p.lifecycle_status = 'active_operations'
  AND p.is_demo = true
  AND p.handoff_accepted_at IS NULL
  AND p.onboarding_started_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.onboarding_projects op
    WHERE op.property_id = p.id AND op.status <> 'cancelled'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.onboarding_tasks t WHERE t.property_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.property_handoffs h WHERE h.property_id = p.id
  );

CREATE POLICY "Staff can create owner records"
  ON public.property_owners FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update owner records"
  ON public.property_owners FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.property_owners TO authenticated;
GRANT ALL ON public.property_owners TO service_role;