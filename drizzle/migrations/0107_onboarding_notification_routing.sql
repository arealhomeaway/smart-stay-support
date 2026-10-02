-- Follows: the Onboarding Director (or any authorized staff) can follow a home.
CREATE TABLE IF NOT EXISTS public.onboarding_follows (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);
GRANT SELECT, INSERT, DELETE ON public.onboarding_follows TO authenticated;
GRANT ALL ON public.onboarding_follows TO service_role;
ALTER TABLE public.onboarding_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own follows read" ON public.onboarding_follows FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff follow homes" ON public.onboarding_follows FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "Own follows delete" ON public.onboarding_follows FOR DELETE TO authenticated USING (user_id = auth.uid());

-- One delivery path: deduped, actor-excluded, enabled staff only, in-app only.
CREATE OR REPLACE FUNCTION private.notify_onboarding_recipients(
  _recipients uuid[], _actor uuid, _kind text, _title text, _body text,
  _entity_type text, _entity_id uuid, _link text, _is_demo boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid; n integer := 0;
BEGIN
  FOR r IN SELECT DISTINCT x FROM unnest(_recipients) x WHERE x IS NOT NULL LOOP
    CONTINUE WHEN r = _actor;
    CONTINUE WHEN NOT private.enabled_staff_notification_recipient(r);
    INSERT INTO staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
    VALUES (r, _kind, _title, _body, _entity_type, _entity_id, _link, 'normal', _actor, coalesce(_is_demo,false), 'none');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.notify_onboarding_recipients(uuid[],uuid,text,text,text,text,uuid,text,boolean) FROM PUBLIC;

-- Repaired owner Opportunity routing: current Primary PM + Task creator +
-- assigned follow-up owner(s) + followers, instead of a single fallback seat.
CREATE OR REPLACE FUNCTION private.notify_opportunity_staff(_id uuid, _verb text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w record; _owner text; _home text; _link text; _to uuid[] := '{}';
  t_creator uuid; t_assignee uuid; _pm uuid;
BEGIN
  SELECT * INTO w FROM work_items WHERE id=_id;
  IF w IS NULL OR w.property_id IS NULL THEN RETURN; END IF;
  IF w.source_task_id IS NOT NULL THEN
    SELECT created_by, assigned_to INTO t_creator, t_assignee FROM onboarding_tasks WHERE id=w.source_task_id;
  END IF;
  SELECT project_manager INTO _pm FROM onboarding_projects
   WHERE property_id=w.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  _to := ARRAY[_pm, t_creator, t_assignee, w.assigned_to]
      || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=w.property_id), '{}');
  IF _pm IS NULL AND t_creator IS NULL AND t_assignee IS NULL AND w.assigned_to IS NULL THEN
    _to := _to || public.seat_holder('onboarding_director');
  END IF;
  SELECT coalesce(pr.full_name, 'The homeowner') INTO _owner FROM owner_programs p LEFT JOIN profiles pr ON pr.id=p.owner_user_id WHERE p.id=w.program_id;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id=w.property_id;
  _link := '/onboarding/'||w.property_id||'?tab=work'||CASE WHEN w.source_task_id IS NOT NULL THEN '&task='||w.source_task_id ELSE '' END;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_collaboration',
    coalesce(_owner,'The homeowner')||' '||_verb, w.title||' · '||_home, 'work_item', w.id, _link, w.is_demo);
END $function$;

-- Internal Task completion: tell the creator (and followers) when someone else completes it.
CREATE OR REPLACE FUNCTION private.notify_onboarding_task_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := coalesce(auth.uid(), NEW.completed_by); _who text; _home text;
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    SELECT coalesce(full_name, email, 'A teammate') INTO _who FROM profiles WHERE id=_actor;
    SELECT coalesce(nickname, name, 'the home') INTO _home FROM properties WHERE id=NEW.property_id;
    PERFORM private.notify_onboarding_recipients(
      ARRAY[NEW.created_by] || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=NEW.property_id), '{}'),
      _actor, 'onboarding_task_completed', coalesce(_who,'A teammate')||' completed a Task',
      NEW.title||' · '||_home, 'onboarding_task', NEW.id,
      '/onboarding/'||NEW.property_id||'?tab=work&task='||NEW.id, NEW.is_demo);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_onboarding_task_complete ON public.onboarding_tasks;
CREATE TRIGGER trg_notify_onboarding_task_complete AFTER UPDATE OF status ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION private.notify_onboarding_task_complete();

-- Internal Task comments: responsible assignee + creator (+ followers). Staff-only table.
CREATE OR REPLACE FUNCTION private.notify_onboarding_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; _who text; _home text;
BEGIN
  IF NEW.task_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, title, assigned_to, created_by, property_id INTO t FROM onboarding_tasks WHERE id=NEW.task_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(full_name, email, 'A teammate') INTO _who FROM profiles WHERE id=NEW.author_id;
  SELECT coalesce(nickname, name, 'the home') INTO _home FROM properties WHERE id=t.property_id;
  PERFORM private.notify_onboarding_recipients(
    ARRAY[t.assigned_to, t.created_by] || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=t.property_id), '{}'),
    NEW.author_id, 'onboarding_task_comment', coalesce(_who,'A teammate')||' commented: '||left(NEW.body, 80),
    t.title||' · '||_home, 'onboarding_task', t.id,
    '/onboarding/'||t.property_id||'?tab=work&task='||t.id, NEW.is_demo);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_onboarding_note ON public.onboarding_notes;
CREATE TRIGGER trg_notify_onboarding_note AFTER INSERT ON public.onboarding_notes
  FOR EACH ROW EXECUTE FUNCTION private.notify_onboarding_note();