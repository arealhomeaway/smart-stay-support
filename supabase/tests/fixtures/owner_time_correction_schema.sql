-- Isolated fixture only.
CREATE TABLE owner_time_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid,owner_user_id uuid,phase text,entry_date date,minutes integer,activity text,activity_category text,output text,decision_outcome text,materials_reviewed text,attachment_path text,comments text,review_id uuid,ticket_id uuid,amends_entry_id uuid,correction_reason text,review_status text,attested boolean,is_demo boolean);
CREATE TABLE owner_time_entry_properties(entry_id uuid REFERENCES owner_time_entries(id),property_id uuid,PRIMARY KEY(entry_id,property_id));
-- Match the owner-facing permissions: read/insert, but no historical UPDATE policy.
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON owner_time_entries TO authenticated;
GRANT SELECT,INSERT ON owner_time_entry_properties TO authenticated;
ALTER TABLE owner_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON owner_time_entries FOR SELECT TO authenticated USING(owner_user_id=auth.uid());
CREATE POLICY owner_insert ON owner_time_entries FOR INSERT TO authenticated WITH CHECK(owner_user_id=auth.uid());
ALTER TABLE owner_time_entry_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_link_read ON owner_time_entry_properties FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM owner_time_entries e WHERE e.id=entry_id AND e.owner_user_id=auth.uid()));
CREATE POLICY owner_link_insert ON owner_time_entry_properties FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM owner_time_entries e WHERE e.id=entry_id AND e.owner_user_id=auth.uid()));
