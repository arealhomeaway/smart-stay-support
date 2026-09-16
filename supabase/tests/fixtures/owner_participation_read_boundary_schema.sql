-- Local baseline parity; these columns/policies already exist in the application schema.
ALTER POLICY own_properties ON owner_program_properties RENAME TO "Owners read their program properties";
ALTER POLICY owner_read ON owner_time_entries RENAME TO "Owners read their own time entries";
ALTER POLICY owner_link_read ON owner_time_entry_properties RENAME TO "Owners read their entry properties";
ALTER POLICY owner_response_history ON owner_program_events RENAME TO "Owners read their program history";
DROP POLICY owner_response_history_insert ON owner_program_events;
ALTER TABLE owner_review_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their review properties" ON owner_review_properties FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM owner_reviews r WHERE r.id=review_id AND private.owns_program(auth.uid(),r.program_id)));
CREATE POLICY "Staff manage review properties" ON owner_review_properties FOR ALL TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
ALTER TABLE owner_badges ADD COLUMN id uuid DEFAULT gen_random_uuid(), ADD COLUMN trigger_rule text NOT NULL DEFAULT '',
 ADD COLUMN supporting jsonb NOT NULL DEFAULT '{}', ADD COLUMN needs_review boolean NOT NULL DEFAULT false, ADD COLUMN review_note text;
ALTER TABLE owner_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their badges" ON owner_badges FOR SELECT TO authenticated USING(private.owns_program(auth.uid(),program_id));
CREATE POLICY "Staff manage badges" ON owner_badges FOR ALL TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
GRANT SELECT,INSERT,UPDATE ON owner_badges TO authenticated;
ALTER TABLE owner_notifications ADD COLUMN read_at timestamptz, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE owner_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their own alerts" ON owner_notifications FOR SELECT TO authenticated USING(owner_user_id=auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Owners mark their own alerts read" ON owner_notifications FOR UPDATE TO authenticated USING(owner_user_id=auth.uid()) WITH CHECK(owner_user_id=auth.uid());
GRANT SELECT,UPDATE ON owner_notifications TO authenticated;
ALTER TABLE owner_reviews ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'ongoing', ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'active',
 ADD COLUMN IF NOT EXISTS business_question text, ADD COLUMN IF NOT EXISTS evidence text,
 ADD COLUMN IF NOT EXISTS decision_path text NOT NULL DEFAULT 'review', ADD COLUMN IF NOT EXISTS respond_by date,
 ADD COLUMN IF NOT EXISTS outcome text, ADD COLUMN IF NOT EXISTS attachment_path text, ADD COLUMN IF NOT EXISTS photos jsonb,
 ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS staff_context text;

ALTER TABLE owner_program_events ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(), ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION private.owner_sees_property(_user_id uuid,_property_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM owner_programs p LEFT JOIN owner_program_properties e ON e.program_id=p.id WHERE p.owner_user_id=_user_id AND (p.property_id=_property_id OR e.property_id=_property_id)) $$;
-- Exact permissive baseline policy from 20260828145133.
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read onboarding tasks" ON onboarding_tasks FOR SELECT TO authenticated USING(private.is_staff(auth.uid()) OR (private.owner_sees_property(auth.uid(),property_id) AND requires_owner_approval IS TRUE));
GRANT SELECT ON onboarding_tasks TO authenticated;

CREATE TABLE staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,title text,body text,read_at timestamptz);
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE ON staff_notifications TO authenticated;
CREATE POLICY "Recipients read their own notifications" ON staff_notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Recipients mark their own notifications read" ON staff_notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
