ALTER TABLE owner_reviews ADD COLUMN owner_action_type text NOT NULL DEFAULT 'review',
 ADD CONSTRAINT owner_reviews_owner_action_type_check CHECK(owner_action_type IN ('participate','review','approve','attend','research','document'));
CREATE TABLE owner_task_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_action_type text NOT NULL DEFAULT 'review',
 CONSTRAINT owner_task_templates_owner_action_type_check CHECK(owner_action_type IN ('participate','review','approve','attend','research','document')));
INSERT INTO owner_task_templates(owner_action_type) VALUES('document');
