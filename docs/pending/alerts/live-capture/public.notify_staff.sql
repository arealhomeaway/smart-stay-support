CREATE OR REPLACE FUNCTION public.notify_staff(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid, _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.staff_notifications (
    user_id, kind, title, body, entity_type, entity_id, link_path,
    priority, actor_id, email_status, is_demo
  ) VALUES (
    _user_id, _kind, _title, coalesce(_body, ''), _entity_type, _entity_id, _link_path,
    coalesce(_priority, 'normal'), _actor_id,
    CASE WHEN _email AND NOT coalesce(_is_demo, false) THEN 'pending' ELSE 'none' END,
    coalesce(_is_demo, false)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$

