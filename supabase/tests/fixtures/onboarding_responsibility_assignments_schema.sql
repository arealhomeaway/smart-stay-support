-- Local cumulative fixture: restore real role/seat/project RLS prerequisites.
-- Never execute this fixture against a shared database.
CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS banned_until timestamptz;
CREATE TABLE IF NOT EXISTS user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),role text NOT NULL,UNIQUE(user_id,role));
CREATE OR REPLACE FUNCTION public.has_role(_actor uuid,_role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_actor AND role=_role)
$$;
CREATE OR REPLACE FUNCTION public.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN('admin','manager','onboarding'))
$$;
CREATE OR REPLACE FUNCTION public.is_supervisor(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN('admin','manager'))
$$;
CREATE TABLE public.functional_roles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE NOT NULL,name text NOT NULL,
 team text NOT NULL DEFAULT 'property_operations',sort_order integer NOT NULL DEFAULT 0,active boolean NOT NULL DEFAULT true,
 current_seat_holder uuid REFERENCES auth.users(id),current_seat_name text,available boolean NOT NULL DEFAULT true
);
CREATE TABLE public.coverage_overrides(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),role_code text NOT NULL,kind text NOT NULL DEFAULT 'cover' CHECK(kind IN('cover','off')),
 user_id uuid REFERENCES auth.users(id),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at)
);
CREATE FUNCTION public.seat_holder_at(_role_code text,_at timestamptz DEFAULT now()) RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT cover.user_id FROM (SELECT kind,user_id FROM coverage_overrides WHERE role_code=_role_code AND _at>=starts_at AND _at<ends_at ORDER BY created_at DESC LIMIT 1) cover WHERE cover.kind='cover'),
 (SELECT current_seat_holder FROM functional_roles WHERE code=_role_code))
$$;
ALTER TABLE functional_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_overrides ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON functional_roles,coverage_overrides TO authenticated;
GRANT ALL ON functional_roles,coverage_overrides TO service_role;
CREATE POLICY functional_roles_select ON functional_roles FOR SELECT TO authenticated USING(true);
CREATE POLICY functional_roles_insert ON functional_roles FOR INSERT TO authenticated WITH CHECK(public.is_supervisor(auth.uid()));
CREATE POLICY functional_roles_update ON functional_roles FOR UPDATE TO authenticated USING(public.is_supervisor(auth.uid())) WITH CHECK(public.is_supervisor(auth.uid()));
CREATE POLICY functional_roles_delete ON functional_roles FOR DELETE TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Internal staff can read coverage overrides" ON coverage_overrides FOR SELECT TO authenticated USING(public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Supervisors manage coverage overrides" ON coverage_overrides FOR ALL TO authenticated USING(public.is_supervisor(auth.uid())) WITH CHECK(public.is_supervisor(auth.uid()));
ALTER TABLE onboarding_projects ADD COLUMN IF NOT EXISTS started_by uuid,
 ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE onboarding_projects ADD CONSTRAINT assignment_fixture_property_fk FOREIGN KEY(property_id) REFERENCES properties(id) NOT VALID;
ALTER TABLE onboarding_projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON onboarding_projects TO authenticated;
GRANT ALL ON onboarding_projects TO service_role;
CREATE POLICY "Internal staff read onboarding projects" ON onboarding_projects FOR SELECT TO authenticated USING(public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Onboarding staff manage onboarding projects" ON onboarding_projects FOR ALL TO authenticated USING(public.is_onboarding_staff(auth.uid())) WITH CHECK(public.is_onboarding_staff(auth.uid()));

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004'),
 ('00000000-0000-4000-8000-000000000005'),('00000000-0000-4000-8000-000000000006'),
 ('00000000-0000-4000-8000-000000000007');
INSERT INTO user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000001','admin'),('00000000-0000-4000-8000-000000000002','manager'),
 ('00000000-0000-4000-8000-000000000003','onboarding'),('00000000-0000-4000-8000-000000000004','onboarding'),
 ('00000000-0000-4000-8000-000000000005','owner'),('00000000-0000-4000-8000-000000000006','onboarding'),
 ('00000000-0000-4000-8000-000000000007','onboarding');
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='00000000-0000-4000-8000-000000000007';
INSERT INTO functional_roles(code,name) VALUES('director_ops','Director of Operations'),('ops_supervisor','Operations Supervisor'),('po_day','Property Operations');
INSERT INTO properties(id) VALUES('00000000-0000-4000-8000-000000000301'),
 ('00000000-0000-4000-8000-000000000302'),('00000000-0000-4000-8000-000000000303');
