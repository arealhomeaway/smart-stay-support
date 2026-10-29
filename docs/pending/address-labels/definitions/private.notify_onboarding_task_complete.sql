CREATE OR REPLACE FUNCTION private.notify_onboarding_task_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _actor uuid := coalesce(auth.uid(), NEW.completed_by); _who text; _home text;
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    SELECT coalesce(full_name, email, 'A teammate') INTO _who FROM profiles WHERE id=_actor;
    SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id=NEW.property_id;
    PERFORM private.notify_onboarding_recipients(
      ARRAY[NEW.created_by] || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=NEW.property_id), '{}'),
      _actor, 'onboarding_task_completed', coalesce(_who,'A teammate')||' completed a Task',
      NEW.title||' · '||_home, 'onboarding_task', NEW.id,
      '/onboarding/'||NEW.property_id||'?tab=work&task='||NEW.id, NEW.is_demo);
  END IF;
  RETURN NEW;
END $function$
;