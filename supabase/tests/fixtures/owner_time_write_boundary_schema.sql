-- Local auth/role baseline shared with the following invitation fixture.
CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),role text NOT NULL,UNIQUE(user_id,role));
-- Local-only extensions and actual policy names for the full time write boundary.
ALTER POLICY owner_insert ON owner_time_entries RENAME TO "Owners log their own time";
ALTER POLICY owner_link_insert ON owner_time_entry_properties RENAME TO "Owners link their own entries";
ALTER TABLE owner_time_entries ADD COLUMN IF NOT EXISTS reviewed_by uuid,
 ADD COLUMN IF NOT EXISTS reviewed_at timestamptz, ADD COLUMN IF NOT EXISTS review_note text,
 ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE owner_reviews ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE owner_programs ADD COLUMN IF NOT EXISTS last_owner_activity_at timestamptz;
ALTER TABLE owner_program_properties ADD COLUMN IF NOT EXISTS last_owner_activity_at timestamptz;
CREATE POLICY "Staff read owner time entries" ON owner_time_entries FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY "Supervisors review owner time entries" ON owner_time_entries FOR UPDATE TO authenticated
 USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
 WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Staff read entry properties" ON owner_time_entry_properties FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
GRANT SELECT ON audit_log TO authenticated;
