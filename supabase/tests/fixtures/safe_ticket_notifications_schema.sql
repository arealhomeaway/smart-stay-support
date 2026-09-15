CREATE ROLE anon;
ALTER TABLE property_owners ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE owner_programs ADD COLUMN notify_email boolean DEFAULT false, ADD COLUMN notify_sms_p1 boolean DEFAULT false;
ALTER TABLE tickets ADD COLUMN title text, ADD COLUMN description text, ADD COLUMN resolution_notes text,
 ADD COLUMN status text, ADD COLUMN priority text, ADD COLUMN is_demo boolean DEFAULT false;
CREATE TABLE owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid,owner_user_id uuid,ticket_id uuid,
 kind text,priority text,title text,body text,action_path text,email_status text,sms_status text);
ALTER TABLE owner_notifications ADD COLUMN review_id uuid;
ALTER TABLE owner_reviews ADD COLUMN ticket_id uuid, ADD COLUMN is_demo boolean DEFAULT false,
 ADD COLUMN title text, ADD COLUMN recommendation text, ADD COLUMN impact text;
