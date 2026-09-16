-- Local-only auth/invitation baseline used by the cumulative migration fixture.
CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz,
 ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS banned_until timestamptz;
CREATE TABLE IF NOT EXISTS user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),role text NOT NULL,UNIQUE(user_id,role));
CREATE TABLE owner_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,program_id uuid NOT NULL REFERENCES owner_programs(id),
 owner_email text,expires_at timestamptz NOT NULL DEFAULT now()+interval '60 days',
 redeemed_by uuid REFERENCES auth.users(id),redeemed_at timestamptz,created_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE owner_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON owner_invites TO authenticated;
GRANT ALL ON owner_invites,user_roles,owner_programs,owner_program_events TO service_role;
CREATE POLICY "Staff read owner invites" ON owner_invites FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY "Supervisors manage owner invites" ON owner_invites FOR ALL TO authenticated
 USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
 WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
ALTER TABLE owner_programs ADD COLUMN IF NOT EXISTS owner_email text, ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true;
-- Real service access bypasses RLS; normal authenticated users remain policy-bound.
ALTER ROLE service_role BYPASSRLS;
