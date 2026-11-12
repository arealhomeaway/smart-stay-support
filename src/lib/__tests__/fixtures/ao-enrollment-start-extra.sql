-- Live table shapes added after active-owner-fix-schema.sql was captured (read from the live database Nov 12).
ALTER TABLE public."ao_library_cards" ADD COLUMN "once_per_owner" boolean DEFAULT false;
ALTER TABLE public."property_labels" ADD COLUMN "system_key" text;
ALTER TABLE public."onboarding_tasks" ADD COLUMN "started_at" timestamp with time zone;
ALTER TABLE public."onboarding_tasks" ADD COLUMN "started_by" uuid;
ALTER TABLE public."onboarding_tasks" ADD COLUMN "task_kind" text DEFAULT 'do_it'::text;
ALTER TABLE public."onboarding_tasks" ADD COLUMN "kind_settings" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public."onboarding_tasks" ADD COLUMN "follow_up_of" uuid;
ALTER TABLE public."onboarding_projects" ADD COLUMN "inspection_on" date;
CREATE TABLE public.ao_plan_ready_notices(
  notification_id uuid NOT NULL,
  program_id uuid NOT NULL,
  property_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
  open_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.ao_owner_email_days(
  owner_key uuid NOT NULL,
  day date NOT NULL,
  kind text NOT NULL,
  notification_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
INSERT INTO public.property_labels(name, system_key) VALUES ('Active Owner', 'active_owner');
