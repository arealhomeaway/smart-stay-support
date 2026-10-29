CREATE OR REPLACE FUNCTION private.notify_opportunity_staff(_id uuid, _verb text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _to := ARRAY[_pm, t_creator, t_assignee, w.assigned_to, public.seat_holder('onboarding_director')]
      || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=w.property_id), '{}');
  SELECT coalesce(pr.full_name, 'The homeowner') INTO _owner FROM owner_programs p LEFT JOIN profiles pr ON pr.id=p.owner_user_id WHERE p.id=w.program_id;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id=w.property_id;
  _link := '/onboarding/'||w.property_id||'?opp='||w.id;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_collaboration',
    coalesce(_owner,'The homeowner')||' '||_verb, w.title||' · '||_home, 'work_item', w.id, _link, w.is_demo);
END $function$
