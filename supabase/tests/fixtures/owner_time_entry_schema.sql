-- Local fixtures for the real logging transaction and existing owner visibility.
CREATE TABLE owner_programs(id uuid PRIMARY KEY,owner_user_id uuid,status text,started_on date,is_demo boolean DEFAULT false);
CREATE TABLE owner_reviews(id uuid PRIMARY KEY,program_id uuid,property_id uuid,status text,available_from timestamptz);
ALTER TABLE owner_reviews ADD COLUMN task_type text DEFAULT 'property_specific';
CREATE TABLE owner_review_properties(review_id uuid,property_id uuid);
GRANT SELECT ON owner_review_properties TO authenticated;
CREATE TABLE owner_program_properties(program_id uuid,property_id uuid,inclusion_status text,closing_date date);
CREATE TABLE tickets(id uuid PRIMARY KEY,property_id uuid);
GRANT SELECT ON tickets TO authenticated;
GRANT SELECT ON owner_programs,owner_reviews,owner_program_properties TO authenticated;
ALTER TABLE owner_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_program ON owner_programs FOR SELECT TO authenticated USING(owner_user_id=auth.uid());
ALTER TABLE owner_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_review ON owner_reviews FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id));
ALTER TABLE owner_program_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_properties ON owner_program_properties FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id));
