-- ===== Template configuration (stages, step settings, owner Opportunity content) =====
CREATE TABLE public.onboarding_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_template_stages TO authenticated;
GRANT ALL ON public.onboarding_template_stages TO service_role;
ALTER TABLE public.onboarding_template_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Onboarding staff read stages" ON public.onboarding_template_stages FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Supervisors manage stages" ON public.onboarding_template_stages FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS functional_role text,
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS condition jsonb,
  ADD COLUMN IF NOT EXISTS opportunity jsonb;
COMMENT ON COLUMN public.onboarding_template_tasks.opportunity IS
  'Active Owner Opportunity content: {title, what, why, how, resources[], ways_to_document, suggested_minutes}. Null = not Active Owner eligible.';

-- ===== Immutable published versions =====
CREATE TABLE public.onboarding_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE RESTRICT,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  UNIQUE (template_id, version)
);
GRANT SELECT ON public.onboarding_template_versions TO authenticated;
GRANT ALL ON public.onboarding_template_versions TO service_role;
ALTER TABLE public.onboarding_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read template versions" ON public.onboarding_template_versions FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.block_template_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published template versions cannot be changed. Publish a new version instead.'; END $$;
CREATE TRIGGER block_template_version_mutation BEFORE UPDATE OR DELETE ON public.onboarding_template_versions
FOR EACH ROW EXECUTE FUNCTION public.block_template_version_mutation();

CREATE OR REPLACE FUNCTION public.publish_onboarding_template(_template_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v int; new_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Only onboarding leadership can publish a template.';
  END IF;
  SELECT coalesce(max(version),0)+1 INTO v FROM onboarding_template_versions WHERE template_id=_template_id;
  INSERT INTO onboarding_template_versions(template_id, version, snapshot, published_by)
  SELECT _template_id, v, jsonb_build_object(
    'stages', coalesce((SELECT jsonb_agg(jsonb_build_object('name',s.name,'sort_order',s.sort_order) ORDER BY s.sort_order)
                FROM onboarding_template_stages s WHERE s.template_id=_template_id AND s.active),'[]'::jsonb),
    'steps', coalesce((SELECT jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order)
                FROM onboarding_template_tasks t WHERE t.template_id=_template_id AND t.is_active
                  AND (NOT EXISTS (SELECT 1 FROM onboarding_template_stages s WHERE s.template_id=_template_id)
                       OR EXISTS (SELECT 1 FROM onboarding_template_stages s WHERE s.template_id=_template_id AND s.name=t.stage AND s.active))),'[]'::jsonb)),
    auth.uid()
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.publish_onboarding_template(uuid) TO authenticated;

-- ===== Project handoff (2-step) + version pin =====
ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS template_version_id uuid REFERENCES public.onboarding_template_versions(id),
  ADD COLUMN IF NOT EXISTS handoff_state text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS ready_for_ops_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_for_ops_by uuid,
  ADD COLUMN IF NOT EXISTS ops_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ops_accepted_by uuid;

ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS template_task_id uuid,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true;

-- ===== Shared Work Item engine =====
CREATE TABLE public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL CHECK (department IN ('onboarding','operations')),
  kind text NOT NULL CHECK (kind IN ('task','opportunity')),
  property_id uuid REFERENCES public.properties(id),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  linked_task_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.owner_programs(id),
  title text NOT NULL,
  owner_content jsonb,
  status text NOT NULL DEFAULT 'open',
  functional_role text,
  assigned_to uuid,
  due_on date,
  required boolean NOT NULL DEFAULT true,
  blocks_handoff boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id, kind),
  -- An Opportunity never blocks handoff.
  CHECK (kind = 'task' OR blocks_handoff = false)
);
CREATE INDEX work_items_property_idx ON public.work_items(property_id);
CREATE INDEX work_items_program_idx ON public.work_items(program_id) WHERE kind='opportunity';
GRANT SELECT ON public.work_items TO authenticated;
GRANT ALL ON public.work_items TO service_role;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read work items" ON public.work_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Owners read their Opportunities" ON public.work_items FOR SELECT TO authenticated
  USING (kind='opportunity' AND EXISTS (SELECT 1 FROM public.owner_programs p WHERE p.id=work_items.program_id AND p.owner_user_id=auth.uid()));
CREATE TRIGGER work_items_updated BEFORE UPDATE ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Every onboarding task is a Work Item (kind task); eligible ones generate a linked Opportunity.
CREATE OR REPLACE FUNCTION public.sync_onboarding_work_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE wid uuid; opp jsonb; prog uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE work_items SET status='archived' WHERE source_table='onboarding_tasks' AND source_id=OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO work_items(department,kind,property_id,source_table,source_id,title,status,functional_role,assigned_to,due_on,required,blocks_handoff,completed_at,is_demo)
  VALUES ('onboarding','task',NEW.property_id,'onboarding_tasks',NEW.id,NEW.title,
          CASE WHEN NEW.archived_at IS NOT NULL THEN 'archived' ELSE NEW.status END,
          NEW.assigned_seat,NEW.assigned_to,NEW.due_on,NEW.is_required,NEW.blocks_handoff,NEW.completed_at,coalesce(NEW.is_demo,false))
  ON CONFLICT (source_table,source_id,kind) DO UPDATE SET title=EXCLUDED.title,status=EXCLUDED.status,
    functional_role=EXCLUDED.functional_role,assigned_to=EXCLUDED.assigned_to,due_on=EXCLUDED.due_on,
    required=EXCLUDED.required,blocks_handoff=EXCLUDED.blocks_handoff,completed_at=EXCLUDED.completed_at
  RETURNING id INTO wid;

  IF TG_OP='INSERT' AND NEW.template_task_id IS NOT NULL AND NEW.archived_at IS NULL THEN
    SELECT opportunity INTO opp FROM onboarding_template_tasks WHERE id=NEW.template_task_id;
    IF opp IS NOT NULL THEN
      SELECT pp.program_id INTO prog FROM owner_program_properties pp JOIN owner_programs p ON p.id=pp.program_id
       WHERE pp.property_id=NEW.property_id AND pp.inclusion_status='included' AND pp.archived_at IS NULL
         AND p.archived_at IS NULL AND p.status NOT IN ('closed','completed','complete') LIMIT 1;
      IF prog IS NOT NULL THEN
        INSERT INTO work_items(department,kind,property_id,source_table,source_id,linked_task_id,program_id,title,owner_content,functional_role,due_on,required,blocks_handoff,is_demo)
        VALUES ('onboarding','opportunity',NEW.property_id,'onboarding_tasks',NEW.id,wid,prog,
                coalesce(opp->>'title',NEW.title),opp,'owner',NEW.due_on,false,false,coalesce(NEW.is_demo,false))
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_onboarding_work_item AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_onboarding_work_item();

-- Operations tickets join the same engine as Work Items (kind task).
CREATE OR REPLACE FUNCTION public.sync_ticket_work_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO work_items(department,kind,property_id,source_table,source_id,title,status,assigned_to,required,blocks_handoff,completed_at,is_demo)
  VALUES ('operations','task',NEW.property_id,'tickets',NEW.id,coalesce(NEW.title,'Ticket'),coalesce(NEW.status,'open'),NEW.assigned_to,true,false,NEW.resolved_at,coalesce(NEW.is_demo,false))
  ON CONFLICT (source_table,source_id,kind) DO UPDATE SET title=EXCLUDED.title,status=EXCLUDED.status,assigned_to=EXCLUDED.assigned_to,completed_at=EXCLUDED.completed_at;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_ticket_work_item AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_work_item();

-- Owners complete their own Opportunity; it never touches the internal Task.
CREATE OR REPLACE FUNCTION public.complete_owner_opportunity(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE work_items w SET status='complete', completed_at=now()
   WHERE w.id=_id AND w.kind='opportunity'
     AND EXISTS (SELECT 1 FROM owner_programs p WHERE p.id=w.program_id AND p.owner_user_id=auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'This Opportunity is not available to you.'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.complete_owner_opportunity(uuid) TO authenticated;

-- ===== Seat holder helper (role -> person, never hard-coded) =====
CREATE OR REPLACE FUNCTION public.seat_holder(_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT current_seat_holder FROM functional_roles WHERE code=_code AND active LIMIT 1
$$;

-- ===== V2 instantiation from the pinned published version =====
CREATE OR REPLACE FUNCTION public.instantiate_onboarding_v2(_project_id uuid, _version_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr onboarding_projects; snap jsonb; step jsonb; n int := 0; anchor date; who uuid; role text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Only onboarding leadership can start a V2 plan.';
  END IF;
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id;
  SELECT snapshot INTO snap FROM onboarding_template_versions WHERE id=_version_id;
  IF pr.id IS NULL OR snap IS NULL THEN RAISE EXCEPTION 'Project or template version not found.'; END IF;
  FOR step IN SELECT * FROM jsonb_array_elements(snap->'steps') LOOP
    role := step->>'functional_role';
    who := CASE role
      WHEN 'onboarding_project_manager' THEN pr.project_manager
      WHEN 'onboarding_director' THEN coalesce(pr.director, public.seat_holder('onboarding_director'))
      WHEN 'utilities' THEN coalesce(pr.utility_manager, public.seat_holder('utilities'))
      WHEN 'owner' THEN NULL
      ELSE public.seat_holder(role) END;
    anchor := CASE step->>'schedule_anchor'
      WHEN 'planned_closing' THEN pr.planned_closing_on
      WHEN 'actual_closing' THEN pr.planned_closing_on
      ELSE pr.possession_on END;
    INSERT INTO onboarding_tasks(property_id,stage,title,detail,assigned_to,assigned_seat,due_on,status,blocks_handoff,is_required,
      requires_owner_approval,evidence_required,sort_order,schedule_anchor,schedule_offset_days,due_on_source,tags,template_task_id,is_demo)
    VALUES (pr.property_id, step->>'stage', step->>'title', step->>'detail', who, role,
      CASE WHEN anchor IS NOT NULL AND step->>'offset_days' IS NOT NULL THEN anchor + (step->>'offset_days')::int END,
      'open', coalesce((step->>'blocks_handoff')::boolean,false), coalesce((step->>'is_required')::boolean,true),
      coalesce((step->>'requires_owner_approval')::boolean,false), coalesce((step->>'evidence_required')::boolean,false),
      coalesce((step->>'sort_order')::int,0), step->>'schedule_anchor', (step->>'offset_days')::int, 'template_v2',
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(step->'tags','[]'::jsonb)) x),'{}'),
      (step->>'id')::uuid, pr.is_demo);
    n := n + 1;
  END LOOP;
  UPDATE onboarding_projects SET template_version_id=_version_id WHERE id=_project_id;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.instantiate_onboarding_v2(uuid,uuid) TO authenticated;

-- ===== 2-step handoff =====
CREATE OR REPLACE FUNCTION public.open_handoff_blockers(_property_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM onboarding_tasks
   WHERE property_id=_property_id AND archived_at IS NULL AND blocks_handoff AND is_required
     AND status NOT IN ('complete','done')
$$;
GRANT EXECUTE ON FUNCTION public.open_handoff_blockers(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_ready_for_operations(_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr onboarding_projects;
BEGIN
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'Project not found.'; END IF;
  IF NOT (auth.uid() = public.seat_holder('onboarding_director') OR auth.uid() = pr.director OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only the Onboarding Director can mark a home Ready for Operations.';
  END IF;
  IF public.open_handoff_blockers(pr.property_id) > 0 THEN
    RAISE EXCEPTION 'Required handoff Tasks are still open.';
  END IF;
  UPDATE onboarding_projects SET handoff_state='ready', ready_for_ops_at=now(), ready_for_ops_by=auth.uid() WHERE id=_project_id;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_operations(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_into_operations(_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr onboarding_projects;
BEGIN
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF pr.id IS NULL OR pr.handoff_state <> 'ready' THEN RAISE EXCEPTION 'This home has not been marked Ready for Operations.'; END IF;
  IF NOT (auth.uid() = public.seat_holder('director_ops') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only the Operations Director can accept a home into operations.';
  END IF;
  IF public.open_handoff_blockers(pr.property_id) > 0 THEN
    RAISE EXCEPTION 'Deficiency Tasks are still open. Accept once they are resolved.';
  END IF;
  UPDATE onboarding_projects SET handoff_state='accepted', ops_accepted_at=now(), ops_accepted_by=auth.uid(),
    status='complete', completed_at=now() WHERE id=_project_id;
  UPDATE properties SET lifecycle_status='active' WHERE id=pr.property_id;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_handoff_deficiency(_project_id uuid, _title text, _detail text, _role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr onboarding_projects; new_id uuid; who uuid;
BEGIN
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id;
  IF pr.id IS NULL OR pr.handoff_state <> 'ready' THEN RAISE EXCEPTION 'Deficiencies are logged on homes marked Ready for Operations.'; END IF;
  IF NOT (auth.uid() = public.seat_holder('director_ops') OR public.has_role(auth.uid(),'admin') OR public.is_supervisor(auth.uid())) THEN
    RAISE EXCEPTION 'Only Operations leadership can log a handoff deficiency.';
  END IF;
  IF length(trim(coalesce(_title,''))) < 3 THEN RAISE EXCEPTION 'Describe the deficiency.'; END IF;
  who := CASE coalesce(_role,'onboarding_project_manager')
    WHEN 'onboarding_project_manager' THEN pr.project_manager
    WHEN 'onboarding_director' THEN coalesce(pr.director, public.seat_holder('onboarding_director'))
    WHEN 'utilities' THEN coalesce(pr.utility_manager, public.seat_holder('utilities'))
    ELSE public.seat_holder(_role) END;
  INSERT INTO onboarding_tasks(property_id,stage,title,detail,assigned_to,assigned_seat,status,blocks_handoff,is_required,tags,due_on,due_on_source,created_by,is_demo)
  VALUES (pr.property_id,'Handoff deficiencies',trim(_title),nullif(trim(coalesce(_detail,'')),''),who,coalesce(_role,'onboarding_project_manager'),
          'open',true,true,ARRAY['deficiency'],current_date+2,'handoff_deficiency',auth.uid(),pr.is_demo)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.log_handoff_deficiency(uuid,text,text,text) TO authenticated;

-- Backfill: existing onboarding tasks and tickets join the shared engine.
INSERT INTO public.work_items(department,kind,property_id,source_table,source_id,title,status,functional_role,assigned_to,due_on,required,blocks_handoff,completed_at,is_demo)
SELECT 'onboarding','task',property_id,'onboarding_tasks',id,title,CASE WHEN archived_at IS NOT NULL THEN 'archived' ELSE status END,
       assigned_seat,assigned_to,due_on,is_required,blocks_handoff,completed_at,coalesce(is_demo,false)
FROM public.onboarding_tasks ON CONFLICT DO NOTHING;
INSERT INTO public.work_items(department,kind,property_id,source_table,source_id,title,status,assigned_to,required,blocks_handoff,completed_at,is_demo)
SELECT 'operations','task',property_id,'tickets',id,coalesce(title,'Ticket'),coalesce(status,'open'),assigned_to,true,false,resolved_at,coalesce(is_demo,false)
FROM public.tickets ON CONFLICT DO NOTHING;