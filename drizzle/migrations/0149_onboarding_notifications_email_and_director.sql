CREATE OR REPLACE FUNCTION private.notify_onboarding_recipients(
  _recipients uuid[], _actor uuid, _kind text, _title text, _body text,
  _entity_type text, _entity_id uuid, _link text, _is_demo boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid; n integer := 0; _prop uuid;
BEGIN
  _prop := nullif(split_part(split_part(_link, '/onboarding/', 2), '?', 1), '')::uuid;
  FOR r IN SELECT DISTINCT x FROM unnest(_recipients) x WHERE x IS NOT NULL LOOP
    CONTINUE WHEN r = _actor;
    CONTINUE WHEN NOT private.onboarding_scope_ok(r, _prop);
    INSERT INTO staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
    VALUES (r, _kind, _title, _body, _entity_type, _entity_id, _link, 'normal', _actor, coalesce(_is_demo,false),
            CASE WHEN coalesce(_is_demo,false) THEN 'none' ELSE 'pending' END);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

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
  -- PM, Task participants and followers keep their alerts; the active
  -- Onboarding Director seat holder is always added alongside them.
  _to := ARRAY[_pm, t_creator, t_assignee, w.assigned_to, public.seat_holder('onboarding_director')]
      || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=w.property_id), '{}');
  SELECT coalesce(pr.full_name, 'The homeowner') INTO _owner FROM owner_programs p LEFT JOIN profiles pr ON pr.id=p.owner_user_id WHERE p.id=w.program_id;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id=w.property_id;
  _link := '/onboarding/'||w.property_id||'?tab=work'||CASE WHEN w.source_task_id IS NOT NULL THEN '&task='||w.source_task_id ELSE '' END;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_collaboration',
    coalesce(_owner,'The homeowner')||' '||_verb, w.title||' · '||_home, 'work_item', w.id, _link, w.is_demo);
END $function$;