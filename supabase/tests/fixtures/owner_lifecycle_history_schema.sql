-- Exact production column types omitted by earlier disposable fixtures.
CREATE TABLE IF NOT EXISTS public.profiles(id uuid PRIMARY KEY,full_name text,email text);
ALTER TABLE owner_programs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE owner_programs ADD COLUMN IF NOT EXISTS created_by uuid, ADD COLUMN IF NOT EXISTS onboarding_target_hours numeric DEFAULT 60,
 ADD COLUMN IF NOT EXISTS ongoing_target_hours numeric DEFAULT 40;
ALTER TABLE owner_programs ALTER COLUMN onboarding_lead TYPE uuid USING nullif(onboarding_lead,'')::uuid,
 ALTER COLUMN operations_lead TYPE uuid USING nullif(operations_lead,'')::uuid;
ALTER TABLE owner_program_properties ALTER COLUMN inclusion_status SET DEFAULT 'included';
ALTER TABLE owner_program_properties ADD COLUMN IF NOT EXISTS added_by uuid;
ALTER TABLE owner_task_templates ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS phase text DEFAULT 'ongoing',ADD COLUMN IF NOT EXISTS stage text DEFAULT 'Recurring',
 ADD COLUMN IF NOT EXISTS title text DEFAULT 'Roadmap activity',ADD COLUMN IF NOT EXISTS summary text DEFAULT 'Review this activity',
 ADD COLUMN IF NOT EXISTS owner_action text DEFAULT 'Review the request',ADD COLUMN IF NOT EXISTS decision_path text DEFAULT 'consult',
 ADD COLUMN IF NOT EXISTS respond_within_days integer DEFAULT 7,ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE owner_reviews ADD COLUMN IF NOT EXISTS template_id uuid,ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,ADD COLUMN IF NOT EXISTS created_by uuid;
GRANT INSERT,UPDATE,DELETE ON owner_reviews,owner_review_properties,owner_program_events TO authenticated;
GRANT ALL ON owner_programs,owner_program_properties,owner_reviews,owner_review_properties,owner_program_events TO service_role;

ALTER TABLE owner_reviews ADD COLUMN IF NOT EXISTS onboarding_task_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS owner_reviews_onboarding_task_uniq ON owner_reviews(onboarding_task_id) WHERE onboarding_task_id IS NOT NULL;
