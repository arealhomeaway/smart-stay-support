-- Local baseline columns/RLS needed by the activation transaction; never apply to a shared database.
ALTER TABLE owner_programs ADD COLUMN IF NOT EXISTS ends_on date,
 ADD COLUMN IF NOT EXISTS activated_at timestamptz, ADD COLUMN IF NOT EXISTS activated_by uuid,
 ADD COLUMN IF NOT EXISTS dfy_confirmed boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS dfy_confirmed_at timestamptz,
 ADD COLUMN IF NOT EXISTS target_hours numeric DEFAULT 100, ADD COLUMN IF NOT EXISTS operating_target_hours numeric DEFAULT 105;
ALTER TABLE owner_program_properties ADD COLUMN IF NOT EXISTS closing_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE OR REPLACE FUNCTION public.has_role(_actor uuid,_role text) RETURNS boolean LANGUAGE sql AS $$
 SELECT (_actor='99999999-9999-4999-8999-999999999999'::uuid AND _role='manager')
  OR (_actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AND _role='admin')
  OR (_actor='77777777-7777-4777-8777-777777777777'::uuid AND _role='admin')
  OR (_actor='44444444-4444-4444-8444-444444444444'::uuid AND _role='vendor')
$$;
GRANT SELECT,INSERT,UPDATE ON owner_programs,owner_program_properties TO authenticated;
GRANT SELECT,UPDATE ON properties,property_owners TO authenticated;
CREATE POLICY "Supervisors manage owner programs" ON owner_programs
 FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
 WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Staff manage program properties" ON owner_program_properties
 FOR ALL TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
