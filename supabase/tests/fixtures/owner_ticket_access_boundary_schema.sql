ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE owner_program_properties ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS closing_confirmed boolean NOT NULL DEFAULT false;
-- Local only: restore the existing Ticket schema and policies around the new boundary.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.has_role(_actor uuid,_role text) RETURNS boolean LANGUAGE sql AS $$
 SELECT (_actor='99999999-9999-4999-8999-999999999999'::uuid AND _role='manager')
 OR (_actor='77777777-7777-4777-8777-777777777777'::uuid AND _role='admin')
 OR (_actor='44444444-4444-4444-8444-444444444444'::uuid AND _role='vendor')
$$;
CREATE FUNCTION private.is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT public.is_staff($1) $$;
CREATE FUNCTION private.can_edit_ticket(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT public.is_staff($1) $$;
ALTER TABLE tickets ADD COLUMN vendor_user_id uuid, ADD COLUMN category text DEFAULT 'maintenance',
 ADD COLUMN reported_at timestamptz DEFAULT now(), ADD COLUMN resolved_at timestamptz,
 ADD COLUMN owner_participation_path text, ADD COLUMN owner_submitted boolean DEFAULT false,
 ADD COLUMN owner_submitted_by uuid, ADD COLUMN created_by uuid,
 ADD COLUMN record_type text DEFAULT 'active_task', ADD COLUMN source_channel text, ADD COLUMN initiator_type text;
ALTER TABLE tickets ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE tickets ADD CONSTRAINT tickets_record_type_chk CHECK(record_type IN ('completed_interaction','active_task','collaborative_matter'));
CREATE FUNCTION private.is_assigned_vendor(_user_id uuid,_ticket_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM tickets WHERE id=_ticket_id AND vendor_user_id=_user_id) $$;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON tickets TO authenticated;
CREATE POLICY tickets_select ON tickets FOR SELECT TO authenticated USING(private.is_staff(auth.uid()) OR vendor_user_id=auth.uid());
CREATE POLICY tickets_insert ON tickets FOR INSERT TO authenticated WITH CHECK(private.is_staff(auth.uid()));
CREATE POLICY tickets_update ON tickets FOR UPDATE TO authenticated USING((private.is_staff(auth.uid()) OR vendor_user_id=auth.uid()) AND (NOT is_demo OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Owners read tickets at their home" ON tickets FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM owner_program_properties e JOIN owner_programs p ON p.id=e.program_id WHERE e.property_id=tickets.property_id AND p.owner_user_id=auth.uid()));
CREATE POLICY "Owners open matters at their own home" ON tickets FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM owner_program_properties e JOIN owner_programs p ON p.id=e.program_id WHERE e.property_id=tickets.property_id AND p.owner_user_id=auth.uid()));
CREATE TABLE ticket_activity(ticket_id uuid,note text);
CREATE TABLE ticket_steps(ticket_id uuid,note text);
ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_steps ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ticket_activity,ticket_steps TO authenticated;
CREATE POLICY ticket_activity_select ON ticket_activity FOR SELECT TO authenticated USING(private.is_staff(auth.uid()) OR private.is_assigned_vendor(auth.uid(),ticket_id));
CREATE POLICY ticket_steps_select ON ticket_steps FOR SELECT TO authenticated USING(private.is_staff(auth.uid()) OR private.is_assigned_vendor(auth.uid(),ticket_id));
