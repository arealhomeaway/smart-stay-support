ALTER TABLE owner_reviews ADD COLUMN owner_decision text, ADD COLUMN responded_at timestamptz,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
GRANT UPDATE ON owner_reviews TO authenticated;
CREATE POLICY own_review_update ON owner_reviews FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id AND p.owner_user_id=auth.uid()))
 WITH CHECK(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id AND p.owner_user_id=auth.uid()));
GRANT SELECT,INSERT ON owner_program_events TO authenticated;
ALTER TABLE owner_program_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_response_history ON owner_program_events FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id AND p.owner_user_id=auth.uid()));
CREATE POLICY owner_response_history_insert ON owner_program_events FOR INSERT TO authenticated
 WITH CHECK(EXISTS(SELECT 1 FROM owner_programs p WHERE p.id=program_id AND p.owner_user_id=auth.uid()));
