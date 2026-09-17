CREATE TABLE property_owners(id uuid PRIMARY KEY);
ALTER TABLE properties ADD COLUMN owner_record_id uuid REFERENCES property_owners(id);
ALTER TABLE owner_programs ADD COLUMN property_id uuid, ADD COLUMN archived_at timestamptz;
-- Existing contact-era records must not be guessed into a canonical identity by the migration.
INSERT INTO owner_programs(id,status) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','draft');
