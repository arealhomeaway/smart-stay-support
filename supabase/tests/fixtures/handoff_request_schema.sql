ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE property_handoffs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE property_handoffs ADD requested_by uuid, ADD checklist jsonb, ADD validation jsonb, ADD carryover_accepted boolean, ADD notes text;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS assigned_to uuid, ADD COLUMN IF NOT EXISTS carryover_reason text;
