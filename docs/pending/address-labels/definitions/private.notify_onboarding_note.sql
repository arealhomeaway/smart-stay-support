CREATE OR REPLACE FUNCTION private.notify_onboarding_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t record; _who text; _home text;
BEGIN
  IF NEW.task_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, title, assigned_to, created_by, property_id INTO t FROM onboarding_tasks WHERE id=NEW.task_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(full_name, email, 'A teammate') INTO _who FROM profiles WHERE id=NEW.author_id;
  SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id=t.property_id;
  PERFORM private.notify_onboarding_recipients(
    ARRAY[t.assigned_to, t.created_by] || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=t.property_id), '{}'),
    NEW.author_id, 'onboarding_task_comment', coalesce(_who,'A teammate')||' commented: '||left(NEW.body, 80),
    t.title||' · '||_home, 'onboarding_task', t.id,
    '/onboarding/'||t.property_id||'?tab=work&task='||t.id, NEW.is_demo);
  RETURN NEW;
END $function$
;