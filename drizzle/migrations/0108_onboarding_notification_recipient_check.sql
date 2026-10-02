CREATE OR REPLACE FUNCTION private.onboarding_recipient_ok(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.is_staff(_user_id)
     AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=_user_id AND r.role IN ('owner','vendor'))
     AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id=_user_id AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now()))
$$;
REVOKE ALL ON FUNCTION private.onboarding_recipient_ok(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.notify_onboarding_recipients(
  _recipients uuid[], _actor uuid, _kind text, _title text, _body text,
  _entity_type text, _entity_id uuid, _link text, _is_demo boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid; n integer := 0;
BEGIN
  FOR r IN SELECT DISTINCT x FROM unnest(_recipients) x WHERE x IS NOT NULL LOOP
    CONTINUE WHEN r = _actor;
    CONTINUE WHEN NOT private.onboarding_recipient_ok(r);
    INSERT INTO staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
    VALUES (r, _kind, _title, _body, _entity_type, _entity_id, _link, 'normal', _actor, coalesce(_is_demo,false), 'none');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;