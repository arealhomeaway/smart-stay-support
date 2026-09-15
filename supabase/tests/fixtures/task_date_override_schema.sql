ALTER TABLE onboarding_projects ADD COLUMN project_manager uuid;
ALTER TABLE onboarding_tasks ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN due_on_overridden boolean DEFAULT false, ADD COLUMN due_on_source text;
