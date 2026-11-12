CREATE OR REPLACE FUNCTION private.ao_plan_ready_notice(_program uuid, _property_ids uuid[], _open integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; nid uuid; homes uuid[]; total int; names text[]; label text;
BEGIN
  IF coalesce(_open, 0) <= 0 THEN RETURN NULL; END IF;
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program;
  IF NOT FOUND OR prog.is_demo OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT n.id, x.property_ids, x.open_count INTO nid, homes, total
    FROM public.owner_notifications n JOIN public.ao_plan_ready_notices x ON x.notification_id = n.id
   WHERE n.program_id = _program AND n.kind = 'ao_plan_ready' AND n.email_status IN ('held', 'skipped') AND n.delivered_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.ao_owner_email_days d WHERE d.notification_id = n.id)
   ORDER BY n.created_at DESC LIMIT 1 FOR UPDATE OF n;
  homes := (SELECT array_agg(DISTINCT h ORDER BY h) FROM unnest(coalesce(homes, ARRAY[]::uuid[]) || _property_ids) h);
  total := coalesce(total, 0) + _open;
  SELECT array_agg(public.format_property_label(to_jsonb(h)) ->> 'primary' ORDER BY h.name) INTO names
    FROM public.properties h WHERE h.id = ANY (homes);
  label := CASE WHEN coalesce(array_length(names, 1), 0) = 0 THEN 'your home'
                WHEN array_length(names, 1) = 1 THEN names[1]
                ELSE array_to_string(names[1:array_length(names, 1) - 1], ', ') || ' and ' || names[array_length(names, 1)] END;
  IF nid IS NULL THEN
    INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
    VALUES (prog.id, prog.owner_user_id, 'ao_plan_ready', 'p3', 'Your homeowner plan is ready',
      format('We added %s %s to your portal for %s. Open your portal to see what''s next.', total, CASE WHEN total = 1 THEN 'activity' ELSE 'activities' END, label),
      '/owner', CASE WHEN prog.notify_email THEN 'held' ELSE 'skipped' END, 'skipped')
    RETURNING id INTO nid;
    INSERT INTO public.ao_plan_ready_notices(notification_id, program_id, property_ids, open_count) VALUES (nid, prog.id, homes, total);
  ELSE
    UPDATE public.owner_notifications SET
      body = format('We added %s %s to your portal for %s. Open your portal to see what''s next.', total, CASE WHEN total = 1 THEN 'activity' ELSE 'activities' END, label)
     WHERE id = nid;
    UPDATE public.ao_plan_ready_notices SET property_ids = homes, open_count = total WHERE notification_id = nid;
  END IF;
  RETURN nid;
END $function$
;
