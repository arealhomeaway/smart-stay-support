-- Live definitions read Nov 22 (before). apply.sql.undo restores these exactly.
CREATE OR REPLACE FUNCTION private.notify_onboarding_recipients(_recipients uuid[], _actor uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid, _link text, _is_demo boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

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
  SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id=w.property_id;
  _link := '/onboarding/'||w.property_id||'?opp='||w.id;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_collaboration',
    coalesce(_owner,'The homeowner')||' '||_verb, w.title||' · '||_home, 'work_item', w.id, _link, w.is_demo);
END $function$;

CREATE OR REPLACE FUNCTION private.owner_item_notify(_review owner_reviews, _title text, _body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE task uuid;
BEGIN
  SELECT task_id INTO task FROM public.owner_item_task_sends WHERE review_id = _review.id;
  task := coalesce(task, _review.onboarding_task_id);
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, email_status, is_demo)
  SELECT uid, 'owner_item_message', left(_title, 200), left(btrim(_body), 500), 'owner_review', _review.id,
         '/onboarding/' || _review.property_id || CASE WHEN task IS NULL THEN '' ELSE '?tab=plan&task=' || task END,
         'normal', CASE WHEN coalesce(_review.is_demo, false) THEN 'none' ELSE 'pending' END, coalesce(_review.is_demo, false)
    FROM private.owner_item_recipients(_review.id) uid;
END $function$;

CREATE OR REPLACE FUNCTION private.owner_item_recipients(_review_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  WITH r AS (SELECT id, property_id, onboarding_task_id FROM public.owner_reviews WHERE id = _review_id),
  t AS (
    SELECT tk.assigned_to FROM r
      LEFT JOIN public.owner_item_task_sends s ON s.review_id = r.id
      JOIN public.onboarding_tasks tk ON tk.id = coalesce(s.task_id, r.onboarding_task_id)
  ),
  assigned AS (SELECT assigned_to AS uid FROM t WHERE assigned_to IS NOT NULL),
  leads AS (
    SELECT p.project_manager AS uid FROM r JOIN public.onboarding_projects p ON p.property_id = r.property_id AND p.status = 'active'
     WHERE NOT EXISTS (SELECT 1 FROM assigned)
    UNION SELECT public.seat_holder('onboarding_director') WHERE NOT EXISTS (SELECT 1 FROM assigned)
  ),
  followers AS (SELECT f.user_id AS uid FROM r JOIN public.onboarding_follows f ON f.property_id = r.property_id)
  SELECT DISTINCT uid FROM (SELECT uid FROM assigned UNION SELECT uid FROM leads UNION SELECT uid FROM followers) x
   WHERE uid IS NOT NULL AND uid IS DISTINCT FROM auth.uid()
$function$;
