
-- roles
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tech')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- properties
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nickname text,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  unit text,
  access_notes text,
  wifi_notes text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "properties_select" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "properties_insert" ON public.properties FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "properties_update" ON public.properties FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "properties_delete_admin" ON public.properties FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- playbooks
CREATE TABLE public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  summary text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbooks TO authenticated;
GRANT ALL ON public.playbooks TO service_role;
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playbooks_select" ON public.playbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "playbooks_insert" ON public.playbooks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "playbooks_update" ON public.playbooks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "playbooks_delete_admin" ON public.playbooks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER playbooks_updated BEFORE UPDATE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.playbook_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  position int NOT NULL,
  instruction text NOT NULL,
  detail text,
  required boolean NOT NULL DEFAULT true,
  photo_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbook_steps TO authenticated;
GRANT ALL ON public.playbook_steps TO service_role;
ALTER TABLE public.playbook_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playbook_steps_select" ON public.playbook_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "playbook_steps_write" ON public.playbook_steps FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref serial,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  playbook_id uuid REFERENCES public.playbooks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  guest_name text,
  guest_contact text,
  guest_in_residence boolean NOT NULL DEFAULT true,
  reported_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vendor_name text,
  resolution_notes text,
  guest_confirmed boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tickets_delete_admin" ON public.tickets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tickets_property_idx ON public.tickets(property_id);
CREATE INDEX tickets_status_idx ON public.tickets(status);

CREATE TABLE public.ticket_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  position int NOT NULL,
  instruction text NOT NULL,
  detail text,
  required boolean NOT NULL DEFAULT true,
  photo_required boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_steps TO authenticated;
GRANT ALL ON public.ticket_steps TO service_role;
ALTER TABLE public.ticket_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_steps_all" ON public.ticket_steps FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX ticket_steps_ticket_idx ON public.ticket_steps(ticket_id);

CREATE TABLE public.ticket_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_activity TO authenticated;
GRANT ALL ON public.ticket_activity TO service_role;
ALTER TABLE public.ticket_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_activity_select" ON public.ticket_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_activity_insert" ON public.ticket_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE INDEX ticket_activity_ticket_idx ON public.ticket_activity(ticket_id);

-- seed playbooks
INSERT INTO public.playbooks (id, category, title, summary) VALUES
('11111111-1111-1111-1111-111111111101','plumbing','Water leak (under sink / fixture)','Stop the water, fix the cause, verify dry, and confirm with the guest before closing.'),
('11111111-1111-1111-1111-111111111102','safety','Alarm / detector service','Any visit touching alarms must leave every fire, smoke and CO device installed and functioning.'),
('11111111-1111-1111-1111-111111111103','hvac','No heat / no cooling','Diagnose thermostat and power before dispatching HVAC.'),
('11111111-1111-1111-1111-111111111104','appliance','Appliance not working','Confirm the failure, check the simple causes, then decide repair vs replace.'),
('11111111-1111-1111-1111-111111111105','access','Guest lockout / access code failure','Get the guest inside fast, then fix the root cause.'),
('11111111-1111-1111-1111-111111111106','pest','Pest sighting','Document, treat, and follow up so it does not recur.');

INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
('11111111-1111-1111-1111-111111111101',1,'Acknowledge the guest within 15 minutes','Tell them what you are doing and give an ETA window.',true,false),
('11111111-1111-1111-1111-111111111101',2,'Ask the guest for a photo/video of the leak','Confirms severity and whether water is active.',true,false),
('11111111-1111-1111-1111-111111111101',3,'Have the guest shut off the local supply valve if water is actively running','Walk them through it on the phone if needed.',true,false),
('11111111-1111-1111-1111-111111111101',4,'Dispatch handyman with the full scope in writing','Scope must say: identify source, repair, dry the cabinet, check for water damage, and test 3x.',true,false),
('11111111-1111-1111-1111-111111111101',5,'Handyman photographs the area BEFORE work','',true,true),
('11111111-1111-1111-1111-111111111101',6,'Run water for 5 full minutes and inspect for drips','Includes drain, supply lines, P-trap, and disposal seal.',true,false),
('11111111-1111-1111-1111-111111111101',7,'Dry the cabinet and check for swelling, mold or damaged flooring','Report anything found as a new ticket.',true,false),
('11111111-1111-1111-1111-111111111101',8,'Handyman photographs the finished area','No missing parts, no exposed holes, cabinet reassembled.',true,true),
('11111111-1111-1111-1111-111111111101',9,'Message the guest to confirm the issue is fully resolved','Do not close until the guest confirms in writing.',true,false),
('11111111-1111-1111-1111-111111111101',10,'Schedule a 24-hour follow-up check','',false,false);

INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
('11111111-1111-1111-1111-111111111102',1,'Test every smoke alarm in the home','Press and hold test button until it sounds.',true,false),
('11111111-1111-1111-1111-111111111102',2,'Test every carbon monoxide alarm','',true,false),
('11111111-1111-1111-1111-111111111102',3,'Check security devices: cameras, sensors, locks, noise monitors','',true,false),
('11111111-1111-1111-1111-111111111102',4,'Replace batteries in any device that chirps or fails the test','',true,false),
('11111111-1111-1111-1111-111111111102',5,'If a device must be removed, install the replacement in the same visit','Never leave a bracket, hole or bare wiring. If no replacement is on hand, do not remove the old device.',true,true),
('11111111-1111-1111-1111-111111111102',6,'Photograph every device installed and mounted','',true,true),
('11111111-1111-1111-1111-111111111102',7,'Log device locations and install dates in the property notes','',true,false);

INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
('11111111-1111-1111-1111-111111111103',1,'Confirm thermostat mode and setpoint with the guest','',true,false),
('11111111-1111-1111-1111-111111111103',2,'Check breaker and unit power switch','',true,false),
('11111111-1111-1111-1111-111111111103',3,'Check air filter condition','',true,false),
('11111111-1111-1111-1111-111111111103',4,'If unresolved, dispatch HVAC with written scope and access instructions','',true,false),
('11111111-1111-1111-1111-111111111103',5,'Provide fans or space heaters if the fix will take more than 4 hours','',true,false),
('11111111-1111-1111-1111-111111111103',6,'Verify temperature holds for 2 hours and confirm with the guest','',true,false);

INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
('11111111-1111-1111-1111-111111111104',1,'Get make, model and a photo of the error from the guest','',true,true),
('11111111-1111-1111-1111-111111111104',2,'Check power, breaker, water supply and door seals','',true,false),
('11111111-1111-1111-1111-111111111104',3,'Check warranty status before scheduling a paid repair','',true,false),
('11111111-1111-1111-1111-111111111104',4,'Offer the guest a workaround while it is down','',true,false),
('11111111-1111-1111-1111-111111111104',5,'Test the appliance through a full cycle after repair','',true,false),
('11111111-1111-1111-1111-111111111104',6,'Confirm with the guest that it works','',true,false);

INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
('11111111-1111-1111-1111-111111111105',1,'Verify the guest identity against the reservation','',true,false),
('11111111-1111-1111-1111-111111111105',2,'Issue a temporary code and confirm entry by phone','',true,false),
('11111111-1111-1111-1111-111111111105',3,'Check lock battery level and replace if under 30%','',true,false),
('11111111-1111-1111-1111-111111111105',4,'Verify the reservation code schedule is correct for the full stay','',true,false),
('11111111-1111-1111-1111-111111111105',5,'Remove the temporary code after the stay ends','',true,false);

INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
('11111111-1111-1111-1111-111111111106',1,'Get photos and the exact location from the guest','',true,true),
('11111111-1111-1111-1111-111111111106',2,'Schedule licensed pest control, same day if possible','',true,false),
('11111111-1111-1111-1111-111111111106',3,'Offer relocation if the unit is not habitable','',true,false),
('11111111-1111-1111-1111-111111111106',4,'Identify and seal the entry point','',true,false),
('11111111-1111-1111-1111-111111111106',5,'Schedule a follow-up treatment within 14 days','',true,false),
('11111111-1111-1111-1111-111111111106',6,'Confirm with the guest that there are no further sightings','',true,false);
