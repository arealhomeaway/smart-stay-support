-- After-handoff owner plan, Phases 1 and 2. Visible only: nothing here creates
-- owner work items, owner notifications or emails, or calls a release function.

CREATE TABLE public.after_handoff_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  source_kind text NOT NULL CHECK (source_kind IN ('template','library')),
  template_id uuid REFERENCES public.owner_task_templates(id),
  library_id uuid REFERENCES public.owner_opportunity_library(id),
  send_after_days integer NOT NULL DEFAULT 0 CHECK (send_after_days BETWEEN 0 AND 3650),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT after_handoff_plan_items_one_source CHECK (
    (source_kind = 'template' AND template_id IS NOT NULL AND library_id IS NULL)
    OR (source_kind = 'library' AND library_id IS NOT NULL AND template_id IS NULL))
);
GRANT SELECT ON public.after_handoff_plan_items TO authenticated;
GRANT ALL ON public.after_handoff_plan_items TO service_role;
ALTER TABLE public.after_handoff_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read the after-handoff plan" ON public.after_handoff_plan_items
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE TABLE public.after_handoff_plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id uuid NOT NULL REFERENCES public.after_handoff_plan_items(id),
  actor_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.after_handoff_plan_events TO authenticated;
GRANT ALL ON public.after_handoff_plan_events TO service_role;
ALTER TABLE public.after_handoff_plan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read after-handoff plan history" ON public.after_handoff_plan_events
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE TABLE public.after_handoff_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  project_id uuid REFERENCES public.onboarding_projects(id),
  plan_item_id uuid REFERENCES public.after_handoff_plan_items(id),
  title text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('template','library')),
  template_id uuid REFERENCES public.owner_task_templates(id),
  library_id uuid REFERENCES public.owner_opportunity_library(id),
  send_on date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','skipped','cancelled','failed')),
  work_item_id uuid REFERENCES public.work_items(id),
  one_off boolean NOT NULL DEFAULT false,
  last_changed_by uuid,
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT after_handoff_schedule_one_source CHECK (
    (source_kind = 'template' AND template_id IS NOT NULL AND library_id IS NULL)
    OR (source_kind = 'library' AND library_id IS NOT NULL AND template_id IS NULL)),
  CONSTRAINT after_handoff_schedule_property_item UNIQUE (property_id, plan_item_id)
);
CREATE INDEX after_handoff_schedule_send_on ON public.after_handoff_schedule(status, send_on);
GRANT SELECT ON public.after_handoff_schedule TO authenticated;
GRANT ALL ON public.after_handoff_schedule TO service_role;
ALTER TABLE public.after_handoff_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read the after-handoff schedule" ON public.after_handoff_schedule
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE TABLE public.after_handoff_schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.after_handoff_schedule(id),
  property_id uuid,
  project_id uuid,
  actor_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.after_handoff_schedule_events TO authenticated;
GRANT ALL ON public.after_handoff_schedule_events TO service_role;
ALTER TABLE public.after_handoff_schedule_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read after-handoff schedule history" ON public.after_handoff_schedule_events
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE FUNCTION private.block_after_handoff_history_change() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'After-handoff history is add-only.'; END $$;
CREATE TRIGGER after_handoff_plan_events_add_only BEFORE UPDATE OR DELETE ON public.after_handoff_plan_events
  FOR EACH ROW EXECUTE FUNCTION private.block_after_handoff_history_change();
CREATE TRIGGER after_handoff_schedule_events_add_only BEFORE UPDATE OR DELETE ON public.after_handoff_schedule_events
  FOR EACH ROW EXECUTE FUNCTION private.block_after_handoff_history_change();

-- Responsibility seat, held by the current Director of Operations holder.
INSERT INTO public.functional_roles(code,name,team,current_seat_holder,current_seat_name,sort_order,active)
SELECT 'active_owner_followup','Active Owner follow-up','operations',d.current_seat_holder,d.current_seat_name,
       coalesce((SELECT max(sort_order) FROM public.functional_roles),0)+1,true
FROM public.functional_roles d WHERE d.code='director_ops'
  AND NOT EXISTS (SELECT 1 FROM public.functional_roles WHERE code='active_owner_followup');

-- Who may edit the plan: Admin, Director of Operations holder or active cover.
CREATE FUNCTION private.after_handoff_plan_editor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND coalesce(
    public.has_role(auth.uid(),'admin')
    OR auth.uid() = public.seat_holder('director_ops')
    OR EXISTS (SELECT 1 FROM public.seat_override_at('director_ops', now()) o WHERE o.kind='cover' AND o.user_id=auth.uid()),
  false) $$;

-- Who may manage follow-up: plan editors, plus the follow-up seat holder or cover.
CREATE FUNCTION private.after_handoff_followup_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND coalesce(
    private.after_handoff_plan_editor()
    OR auth.uid() = public.seat_holder('active_owner_followup')
    OR EXISTS (SELECT 1 FROM public.seat_override_at('active_owner_followup', now()) o WHERE o.kind='cover' AND o.user_id=auth.uid()),
  false) $$;

CREATE FUNCTION public.after_handoff_access() RETURNS TABLE(can_edit_plan boolean, can_manage_followup boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.after_handoff_plan_editor(), private.after_handoff_followup_manager() $$;

CREATE FUNCTION private.after_handoff_source_title(_kind text, _id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN _kind='template' THEN (SELECT title FROM public.owner_task_templates WHERE id=_id AND active)
              WHEN _kind='library' THEN (SELECT title FROM public.owner_opportunity_library WHERE id=_id AND active) END $$;

CREATE FUNCTION public.after_handoff_plan_save(_id uuid, _title text, _source_kind text, _source_id uuid, _send_after_days integer, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE old_row public.after_handoff_plan_items; new_row public.after_handoff_plan_items; _new_id uuid;
BEGIN
  IF NOT private.after_handoff_plan_editor() THEN RAISE EXCEPTION 'Only an Admin or the Director of Operations can change the after-handoff plan.'; END IF;
  IF private.after_handoff_source_title(_source_kind,_source_id) IS NULL THEN RAISE EXCEPTION 'Choose an active owner task template or Library item.'; END IF;
  IF _send_after_days IS NULL OR _send_after_days < 0 THEN RAISE EXCEPTION 'Send day must be 0 or more.'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.after_handoff_plan_items(title,source_kind,template_id,library_id,send_after_days,notes,sort_order,created_by,updated_by)
    VALUES (coalesce(nullif(btrim(_title),''),private.after_handoff_source_title(_source_kind,_source_id)),_source_kind,
            CASE WHEN _source_kind='template' THEN _source_id END, CASE WHEN _source_kind='library' THEN _source_id END,
            _send_after_days,nullif(btrim(coalesce(_notes,'')),''),
            coalesce((SELECT max(sort_order) FROM public.after_handoff_plan_items),0)+1,auth.uid(),auth.uid())
    RETURNING * INTO new_row;
    INSERT INTO public.after_handoff_plan_events(plan_item_id,actor_id,action,new_value) VALUES (new_row.id,auth.uid(),'created',to_jsonb(new_row));
    RETURN new_row.id;
  END IF;
  SELECT * INTO old_row FROM public.after_handoff_plan_items WHERE id=_id FOR UPDATE;
  IF old_row.id IS NULL THEN RAISE EXCEPTION 'Plan item not found.'; END IF;
  UPDATE public.after_handoff_plan_items SET
    title=coalesce(nullif(btrim(_title),''),old_row.title), source_kind=_source_kind,
    template_id=CASE WHEN _source_kind='template' THEN _source_id END, library_id=CASE WHEN _source_kind='library' THEN _source_id END,
    send_after_days=_send_after_days, notes=nullif(btrim(coalesce(_notes,'')),''), updated_by=auth.uid(), updated_at=now()
  WHERE id=_id RETURNING * INTO new_row;
  INSERT INTO public.after_handoff_plan_events(plan_item_id,actor_id,action,old_value,new_value) VALUES (_id,auth.uid(),'updated',to_jsonb(old_row),to_jsonb(new_row));
  RETURN _id;
END $$;

CREATE FUNCTION public.after_handoff_plan_set_active(_id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE old_active boolean;
BEGIN
  IF NOT private.after_handoff_plan_editor() THEN RAISE EXCEPTION 'Only an Admin or the Director of Operations can change the after-handoff plan.'; END IF;
  SELECT active INTO old_active FROM public.after_handoff_plan_items WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan item not found.'; END IF;
  IF old_active = _active THEN RETURN; END IF;
  UPDATE public.after_handoff_plan_items SET active=_active, updated_by=auth.uid(), updated_at=now() WHERE id=_id;
  INSERT INTO public.after_handoff_plan_events(plan_item_id,actor_id,action,old_value,new_value)
  VALUES (_id,auth.uid(),CASE WHEN _active THEN 'activated' ELSE 'deactivated' END,jsonb_build_object('active',old_active),jsonb_build_object('active',_active));
END $$;

CREATE FUNCTION public.after_handoff_plan_reorder(_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF NOT private.after_handoff_plan_editor() THEN RAISE EXCEPTION 'Only an Admin or the Director of Operations can change the after-handoff plan.'; END IF;
  FOR r IN SELECT p.id, p.sort_order, u.ord::int AS ord FROM unnest(_ids) WITH ORDINALITY u(id,ord)
           JOIN public.after_handoff_plan_items p ON p.id=u.id FOR UPDATE OF p LOOP
    IF r.sort_order <> r.ord THEN
      UPDATE public.after_handoff_plan_items SET sort_order=r.ord, updated_by=auth.uid(), updated_at=now() WHERE id=r.id;
      INSERT INTO public.after_handoff_plan_events(plan_item_id,actor_id,action,old_value,new_value)
      VALUES (r.id,auth.uid(),'reordered',jsonb_build_object('sort_order',r.sort_order),jsonb_build_object('sort_order',r.ord));
    END IF;
  END LOOP;
END $$;

-- Called only from perform_handoff_step at acceptance, same transaction.
CREATE FUNCTION private.schedule_after_handoff(_project_id uuid, _property_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _program uuid; _demo boolean; _accept_day date; _n integer;
BEGIN
  SELECT coalesce(is_demo,false) INTO _demo FROM public.properties WHERE id=_property_id;
  IF coalesce(_demo,false) THEN RETURN 0; END IF;
  SELECT op.id INTO _program FROM public.owner_programs op
  WHERE op.status='active' AND NOT op.is_demo AND op.archived_at IS NULL
    AND (op.property_id=_property_id OR EXISTS (SELECT 1 FROM public.owner_program_properties pp
         WHERE pp.program_id=op.id AND pp.property_id=_property_id AND pp.archived_at IS NULL AND NOT pp.is_demo))
  ORDER BY op.created_at DESC LIMIT 1;
  IF _program IS NULL THEN
    INSERT INTO public.after_handoff_schedule_events(property_id,project_id,actor_id,action,note)
    VALUES (_property_id,_project_id,auth.uid(),'no_program','No Active Owner program at handoff; nothing scheduled');
    RETURN 0;
  END IF;
  _accept_day := (now() AT TIME ZONE 'America/Chicago')::date;
  WITH ins AS (
    INSERT INTO public.after_handoff_schedule(program_id,property_id,project_id,plan_item_id,title,source_kind,template_id,library_id,send_on,last_changed_by)
    SELECT _program,_property_id,_project_id,p.id,p.title,p.source_kind,p.template_id,p.library_id,_accept_day+p.send_after_days,auth.uid()
    FROM public.after_handoff_plan_items p WHERE p.active
    ORDER BY p.send_after_days, p.sort_order
    ON CONFLICT (property_id, plan_item_id) DO NOTHING
    RETURNING *
  ), ev AS (
    INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,project_id,actor_id,action,new_value,note)
    SELECT ins.id,_property_id,_project_id,auth.uid(),'scheduled',jsonb_build_object('send_on',ins.send_on,'status','scheduled'),'Scheduled at handoff acceptance'
    FROM ins RETURNING 1
  ) SELECT count(*) INTO _n FROM ev;
  RETURN _n;
END $$;

CREATE FUNCTION public.after_handoff_schedule_update(_id uuid, _action text, _send_on date, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.after_handoff_schedule;
BEGIN
  IF NOT private.after_handoff_followup_manager() THEN RAISE EXCEPTION 'Only the Active Owner follow-up seat, the Director of Operations or an Admin can change this.'; END IF;
  SELECT * INTO s FROM public.after_handoff_schedule WHERE id=_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Scheduled task not found.'; END IF;
  IF s.status <> 'scheduled' THEN RAISE EXCEPTION 'Only scheduled tasks can be changed.'; END IF;
  IF _action='reschedule' THEN
    IF _send_on IS NULL THEN RAISE EXCEPTION 'Choose a new send date.'; END IF;
    UPDATE public.after_handoff_schedule SET send_on=_send_on,last_changed_by=auth.uid(),last_changed_at=now() WHERE id=_id;
    INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,project_id,actor_id,action,old_value,new_value,note)
    VALUES (_id,s.property_id,s.project_id,auth.uid(),'rescheduled',jsonb_build_object('send_on',s.send_on),jsonb_build_object('send_on',_send_on),nullif(btrim(coalesce(_note,'')),''));
  ELSIF _action IN ('skip','cancel') THEN
    UPDATE public.after_handoff_schedule SET status=CASE WHEN _action='skip' THEN 'skipped' ELSE 'cancelled' END,last_changed_by=auth.uid(),last_changed_at=now() WHERE id=_id;
    INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,project_id,actor_id,action,old_value,new_value,note)
    VALUES (_id,s.property_id,s.project_id,auth.uid(),CASE WHEN _action='skip' THEN 'skipped' ELSE 'cancelled' END,
            jsonb_build_object('status',s.status),jsonb_build_object('status',CASE WHEN _action='skip' THEN 'skipped' ELSE 'cancelled' END),nullif(btrim(coalesce(_note,'')),''));
  ELSE RAISE EXCEPTION 'Choose reschedule, skip or cancel.';
  END IF;
END $$;

CREATE FUNCTION public.after_handoff_schedule_add_one_off(_program_id uuid, _property_id uuid, _source_kind text, _source_id uuid, _title text, _send_on date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.after_handoff_schedule; _t text;
BEGIN
  IF NOT private.after_handoff_followup_manager() THEN RAISE EXCEPTION 'Only the Active Owner follow-up seat, the Director of Operations or an Admin can change this.'; END IF;
  _t := private.after_handoff_source_title(_source_kind,_source_id);
  IF _t IS NULL THEN RAISE EXCEPTION 'Choose an active owner task template or Library item.'; END IF;
  IF _send_on IS NULL THEN RAISE EXCEPTION 'Choose a send date.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.owner_programs op WHERE op.id=_program_id AND op.status='active' AND NOT op.is_demo AND op.archived_at IS NULL
                 AND (op.property_id=_property_id OR EXISTS (SELECT 1 FROM public.owner_program_properties pp WHERE pp.program_id=op.id AND pp.property_id=_property_id AND pp.archived_at IS NULL))) THEN
    RAISE EXCEPTION 'Choose a home in an active Active Owner program.';
  END IF;
  INSERT INTO public.after_handoff_schedule(program_id,property_id,title,source_kind,template_id,library_id,send_on,one_off,last_changed_by)
  VALUES (_program_id,_property_id,coalesce(nullif(btrim(_title),''),_t),_source_kind,
          CASE WHEN _source_kind='template' THEN _source_id END, CASE WHEN _source_kind='library' THEN _source_id END,_send_on,true,auth.uid())
  RETURNING * INTO s;
  INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,actor_id,action,new_value,note)
  VALUES (s.id,_property_id,auth.uid(),'one_off_added',jsonb_build_object('send_on',_send_on,'title',s.title),nullif(btrim(coalesce(_note,'')),''));
  RETURN s.id;
END $$;

REVOKE ALL ON FUNCTION private.block_after_handoff_history_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.after_handoff_plan_editor() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.after_handoff_followup_manager() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.after_handoff_source_title(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.schedule_after_handoff(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.after_handoff_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.after_handoff_plan_save(uuid,text,text,uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.after_handoff_plan_set_active(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.after_handoff_plan_reorder(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.after_handoff_schedule_update(uuid,text,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.after_handoff_schedule_add_one_off(uuid,uuid,text,uuid,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.after_handoff_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.after_handoff_plan_save(uuid,text,text,uuid,integer,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.after_handoff_plan_set_active(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.after_handoff_plan_reorder(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.after_handoff_schedule_update(uuid,text,date,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.after_handoff_schedule_add_one_off(uuid,uuid,text,uuid,text,date,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.schedule_after_handoff(uuid,uuid) TO service_role;
