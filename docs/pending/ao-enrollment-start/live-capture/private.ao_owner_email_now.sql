CREATE OR REPLACE FUNCTION private.ao_owner_email_now(_program uuid, _kind text, _title text, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; nid uuid; got int; today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program;
  IF NOT FOUND OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;
  nid := gen_random_uuid();
  got := 0;
  IF prog.notify_email AND NOT prog.is_demo THEN
    INSERT INTO public.ao_owner_email_days(owner_key, day, kind, notification_id)
      VALUES (prog.owner_user_id, today, CASE _kind WHEN 'ao_home_live' THEN 'home_live' WHEN 'ao_plan_ready' THEN 'plan_ready' ELSE 'daily' END, nid)
      ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS got = ROW_COUNT;
  END IF;
  INSERT INTO public.owner_notifications(id, program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, is_demo)
  VALUES (nid, prog.id, prog.owner_user_id, _kind, 'p3', _title, _body, '/owner',
          CASE WHEN NOT prog.notify_email OR prog.is_demo THEN 'skipped' WHEN got = 1 THEN 'pending' ELSE 'held' END, 'skipped', prog.is_demo);
  RETURN nid;
END $function$
;

