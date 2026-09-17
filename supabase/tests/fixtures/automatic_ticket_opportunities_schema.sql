ALTER TABLE tickets ADD COLUMN ref integer DEFAULT 42;
ALTER TABLE owner_reviews ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE owner_reviews ADD COLUMN source_type text, ADD COLUMN phase text, ADD COLUMN stage text,
 ADD COLUMN business_question text, ADD COLUMN decision_path text, ADD COLUMN owner_response text;
CREATE UNIQUE INDEX owner_reviews_program_ticket_uniq ON owner_reviews(program_id,ticket_id) WHERE ticket_id IS NOT NULL;
CREATE UNIQUE INDEX owner_review_properties_key ON owner_review_properties(review_id,property_id);
CREATE TRIGGER owner_reviews_notify_owner AFTER INSERT OR UPDATE ON owner_reviews FOR EACH ROW EXECUTE FUNCTION notify_owner_of_review();
