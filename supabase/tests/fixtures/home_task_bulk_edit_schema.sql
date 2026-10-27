CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE ROLE anon;
CREATE ROLE authenticated;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.actor', true), '')::uuid
$$;
CREATE FUNCTION private.is_onboarding_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.staff', true) = 'true'
$$;
CREATE FUNCTION private.is_onboarding_leader(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.leader', true) = 'true'
$$;

CREATE TABLE public.audit_log(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid, action text NOT NULL, entity_type text NOT NULL, entity_id uuid,
  entity_label text, before_value jsonb, after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.properties(
  id uuid PRIMARY KEY, handoff_accepted_at timestamptz, lifecycle_status text DEFAULT 'onboarding'
);

CREATE TABLE public.onboarding_projects(
  id uuid PRIMARY KEY, property_id uuid NOT NULL, status text NOT NULL DEFAULT 'active',
  project_manager uuid, director uuid, planned_closing_on date, target_handoff_on date, possession_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_project_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, project_id uuid, kind text, new_value text
);

CREATE TABLE public.onboarding_tasks(
  id uuid PRIMARY KEY, property_id uuid NOT NULL, title text NOT NULL, stage text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'open',
  archived_at timestamptz, exception_at timestamptz, due_on date,
  due_on_overridden boolean NOT NULL DEFAULT false, due_on_source text,
  schedule_anchor text, schedule_offset_days integer,
  schedule_offset_unit text NOT NULL DEFAULT 'calendar' CHECK (schedule_offset_unit IN ('calendar','business')),
  assigned_seat text, assigned_to uuid, is_required boolean NOT NULL DEFAULT true,
  blocks_handoff boolean NOT NULL DEFAULT true, requires_owner_approval boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}', completed_at timestamptz, is_demo boolean DEFAULT false
);

-- Mirror of the live rule: homeowner and Active Owner work never blocks handoff.
CREATE FUNCTION public.owner_work_never_blocks_handoff() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(NEW.requires_owner_approval,false) OR coalesce(NEW.tags,'{}'::text[]) @> ARRAY['active_owner'] THEN
    NEW.blocks_handoff := false;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER owner_work_never_blocks_handoff BEFORE INSERT OR UPDATE ON public.onboarding_tasks
FOR EACH ROW EXECUTE FUNCTION public.owner_work_never_blocks_handoff();

-- Mirror of the live work_items sync.
CREATE TABLE public.work_items(
  source_table text, source_id uuid, kind text, title text, status text, functional_role text,
  assigned_to uuid, due_on date, required boolean, blocks_handoff boolean,
  PRIMARY KEY (source_table, source_id, kind)
);
CREATE FUNCTION public.sync_onboarding_work_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO work_items(source_table,source_id,kind,title,status,functional_role,assigned_to,due_on,required,blocks_handoff)
  VALUES ('onboarding_tasks',NEW.id,'task',NEW.title,
    CASE WHEN NEW.archived_at IS NOT NULL THEN 'archived' ELSE NEW.status END,
    NEW.assigned_seat,NEW.assigned_to,NEW.due_on,NEW.is_required,NEW.blocks_handoff)
  ON CONFLICT (source_table,source_id,kind) DO UPDATE SET title=EXCLUDED.title,status=EXCLUDED.status,
    functional_role=EXCLUDED.functional_role,assigned_to=EXCLUDED.assigned_to,due_on=EXCLUDED.due_on,
    required=EXCLUDED.required,blocks_handoff=EXCLUDED.blocks_handoff;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_onboarding_work_item AFTER INSERT OR UPDATE ON public.onboarding_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_onboarding_work_item();

-- Mirror of the live automatic re-dating (calendar days only in this fixture).
CREATE FUNCTION public.recalc_plan_dates_on_anchor_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE onboarding_tasks t SET due_on = (CASE t.schedule_anchor WHEN 'planned_closing' THEN NEW.planned_closing_on
      WHEN 'target_handoff' THEN NEW.target_handoff_on WHEN 'actual_access' THEN NEW.possession_on END) + t.schedule_offset_days
  WHERE t.property_id = NEW.property_id AND t.archived_at IS NULL
    AND t.status NOT IN ('complete','done') AND NOT t.due_on_overridden
    AND t.schedule_offset_days IS NOT NULL AND t.due_on_source = 'template_v2'
    AND ((t.schedule_anchor='planned_closing' AND NEW.planned_closing_on IS DISTINCT FROM OLD.planned_closing_on)
      OR (t.schedule_anchor='target_handoff' AND NEW.target_handoff_on IS DISTINCT FROM OLD.target_handoff_on)
      OR (t.schedule_anchor='actual_access' AND NEW.possession_on IS DISTINCT FROM OLD.possession_on));
  RETURN NEW;
END $$;
CREATE TRIGGER recalc_plan_dates_on_anchor_change AFTER UPDATE ON public.onboarding_projects
FOR EACH ROW EXECUTE FUNCTION public.recalc_plan_dates_on_anchor_change();
