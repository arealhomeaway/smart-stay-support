-- Onboarding scope = the same boundary the Onboarding notes table uses.
CREATE OR REPLACE FUNCTION private.onboarding_scope_ok(_user_id uuid, _property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.onboarding_recipient_ok(_user_id)
     AND (public.is_onboarding_staff(_user_id) OR public.is_supervisor(_user_id)
          OR EXISTS (SELECT 1 FROM onboarding_projects p WHERE p.property_id=_property_id AND p.status<>'cancelled'
                     AND _user_id IN (p.project_manager, p.director)))
     AND EXISTS (SELECT 1 FROM onboarding_projects p WHERE p.property_id=_property_id)
$$;
GRANT EXECUTE ON FUNCTION private.onboarding_scope_ok(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Staff follow homes" ON public.onboarding_follows;
CREATE POLICY "Follow homes in scope" ON public.onboarding_follows FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.onboarding_scope_ok(auth.uid(), property_id));
DROP POLICY IF EXISTS "Own follows read" ON public.onboarding_follows;
CREATE POLICY "Own follows read" ON public.onboarding_follows FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND private.onboarding_scope_ok(auth.uid(), property_id));

-- Every recipient is re-checked against the home's scope at send time, so a
-- lost authorization silently stops alerts (follows included).
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
    VALUES (r, _kind, _title, _body, _entity_type, _entity_id, _link, 'normal', _actor, coalesce(_is_demo,false), 'none');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Reading: onboarding alerts disappear from the bell once the reader leaves that home's scope.
DROP POLICY IF EXISTS "Recipients read their own notifications" ON public.staff_notifications;
CREATE POLICY "Recipients read their own notifications" ON public.staff_notifications FOR SELECT TO authenticated
  USING (private.enabled_staff_notification_recipient(user_id)
    AND (kind NOT IN ('owner_collaboration','onboarding_task_completed','onboarding_task_comment')
         OR link_path NOT LIKE '/onboarding/%'
         OR private.onboarding_scope_ok(user_id, nullif(split_part(split_part(link_path, '/onboarding/', 2), '?', 1), '')::uuid)));