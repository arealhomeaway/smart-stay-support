CREATE OR REPLACE FUNCTION public.notify_staff_isolated(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid, _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF coalesce(_is_demo,false) AND NOT private.demo_notify_ok(_user_id) THEN
    RETURN NULL; -- real staff never receive demo alerts because of a role they hold
  END IF;
  RETURN public.notify_staff(_user_id, _kind, _title, _body, _entity_type, _entity_id, _link_path,
    _priority, _actor_id, _email, _is_demo);
END $function$

