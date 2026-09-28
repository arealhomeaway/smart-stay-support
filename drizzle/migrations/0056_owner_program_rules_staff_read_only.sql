DROP POLICY IF EXISTS "Signed-in users read program rules" ON public.owner_program_rules;
CREATE POLICY "Internal staff read program rules"
  ON public.owner_program_rules FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));