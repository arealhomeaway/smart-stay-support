-- Isolated columns omitted by the earlier transaction fixtures.
ALTER TABLE owner_programs ADD COLUMN completed_at timestamptz, ADD COLUMN completed_by uuid;
CREATE TABLE owner_badges(program_id uuid,code text,awarded_at timestamptz DEFAULT now());
