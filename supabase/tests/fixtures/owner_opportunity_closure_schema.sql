-- Local only: baseline columns and staff history policies omitted by earlier fixtures.
ALTER TABLE owner_reviews ADD COLUMN closed_at timestamptz;
ALTER TABLE owner_program_events ADD COLUMN property_id uuid;
CREATE POLICY "Staff read program history" ON owner_program_events
 FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY "Signed-in users append program history" ON owner_program_events
 FOR INSERT TO authenticated WITH CHECK(public.is_staff(auth.uid()) OR EXISTS(
  SELECT 1 FROM owner_programs p WHERE p.id=program_id AND p.owner_user_id=auth.uid()
 ));
