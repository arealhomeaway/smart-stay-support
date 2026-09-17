-- Local baseline columns and real policy structure for owner Program/Property projections.
ALTER POLICY own_program ON owner_programs RENAME TO "Owners read their own program";
ALTER TABLE property_owners ADD COLUMN IF NOT EXISTS name text,ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE owner_programs ADD COLUMN IF NOT EXISTS owner_name text,ADD COLUMN IF NOT EXISTS owner_phone text,
 ADD COLUMN IF NOT EXISTS onboarding_milestone_hours numeric DEFAULT 60,ADD COLUMN IF NOT EXISTS onboarding_milestone_day integer DEFAULT 35,
 ADD COLUMN IF NOT EXISTS onboarding_lead text,ADD COLUMN IF NOT EXISTS operations_lead text,
 ADD COLUMN IF NOT EXISTS internal_notes text,ADD COLUMN IF NOT EXISTS notify_sms_p1 boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true;
ALTER TABLE owner_program_properties ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN IF NOT EXISTS added_on date NOT NULL DEFAULT current_date,
 ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'not_started',
 ADD COLUMN IF NOT EXISTS launch_status text NOT NULL DEFAULT 'not_ready',
 ADD COLUMN IF NOT EXISTS coverage_status text NOT NULL DEFAULT 'no_activity';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS name text,ADD COLUMN IF NOT EXISTS nickname text,
 ADD COLUMN IF NOT EXISTS address_line1 text,ADD COLUMN IF NOT EXISTS city text,ADD COLUMN IF NOT EXISTS state text,
 ADD COLUMN IF NOT EXISTS primary_photo_url text,ADD COLUMN IF NOT EXISTS private_access_note text;
CREATE OR REPLACE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN('admin','manager','onboarding','tech'))
$$;
CREATE OR REPLACE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_staff($1) $$;
CREATE FUNCTION private.owns_program(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM owner_programs WHERE id=$2 AND owner_user_id=$1)
$$;
GRANT EXECUTE ON FUNCTION private.owns_program(uuid,uuid) TO authenticated;
ALTER POLICY "Owners read their own reviews" ON owner_reviews USING(private.owns_program(auth.uid(),program_id));
ALTER POLICY own_properties ON owner_program_properties USING(private.owns_program(auth.uid(),program_id));
CREATE POLICY "Staff read owner programs" ON owner_programs FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY properties_select ON properties FOR SELECT TO authenticated USING(public.is_staff(auth.uid()) OR EXISTS(SELECT 1 FROM tickets t WHERE t.property_id=properties.id AND t.vendor_user_id=auth.uid()));
CREATE POLICY "Owners read properties in their program" ON properties FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM owner_programs p WHERE p.owner_user_id=auth.uid() AND (p.property_id=properties.id OR EXISTS(SELECT 1 FROM owner_program_properties e WHERE e.program_id=p.id AND e.property_id=properties.id))));
