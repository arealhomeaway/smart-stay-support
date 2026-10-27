CREATE SCHEMA auth;
CREATE SCHEMA private;

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.actor', true), '')::uuid
$$;

CREATE FUNCTION private.is_onboarding_leader(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.leader', true) = 'true'
$$;

CREATE TABLE public.audit_log(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_templates(
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.onboarding_template_stages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.onboarding_template_tasks(
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id),
  title text NOT NULL,
  stage text NOT NULL,
  sort_order integer NOT NULL,
  functional_role text,
  role text,
  is_required boolean NOT NULL DEFAULT true,
  blocks_handoff boolean NOT NULL DEFAULT false,
  offset_days integer,
  schedule_anchor text,
  offset_unit text NOT NULL DEFAULT 'calendar',
  requires_owner_approval boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  CHECK (offset_unit IN ('calendar', 'business'))
);

-- Mirrors the live trigger that keeps homeowner and Active Owner work non-blocking.
CREATE FUNCTION public.owner_work_never_blocks_handoff() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(NEW.requires_owner_approval, false)
     OR coalesce(NEW.tags, '{}'::text[]) @> ARRAY['active_owner'] THEN
    NEW.blocks_handoff := false;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER owner_work_never_blocks_handoff
BEFORE INSERT OR UPDATE ON public.onboarding_template_tasks
FOR EACH ROW EXECUTE FUNCTION public.owner_work_never_blocks_handoff();

-- A live home plan row used to prove template edits do not rewrite existing homes.
CREATE TABLE public.onboarding_tasks(
  id uuid PRIMARY KEY,
  template_task_id uuid,
  title text NOT NULL,
  due_on date
);
