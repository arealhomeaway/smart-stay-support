-- Captured from the live database on Nov 13, 2026 (read only). Restored by apply.undo.sql.
CREATE OR REPLACE FUNCTION public.ao_owner_email_run(_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n record; o record; got int; ready int := 0; daily int := 0; waiting int := 0;
  today date := (_now AT TIME ZONE 'America/Chicago')::date;
  cutoff timestamptz := (today + private.ao_digest_time()) AT TIME ZONE 'America/Chicago';
  body text; nid uuid; prog public.owner_programs;
BEGIN
  FOR n IN SELECT x.* FROM public.owner_notifications x
            WHERE x.kind = 'ao_plan_ready' AND x.email_status = 'held' AND NOT x.is_demo
              AND NOT EXISTS (SELECT 1 FROM public.ao_daily_email_items i WHERE i.notification_id = x.id)
            ORDER BY x.created_at FOR UPDATE SKIP LOCKED LOOP
    INSERT INTO public.ao_owner_email_days(owner_key, day, kind, notification_id)
      VALUES (coalesce(n.owner_user_id, n.program_id), today, 'plan_ready', n.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS got = ROW_COUNT;
    IF got = 1 THEN
      UPDATE public.owner_notifications SET email_status = 'pending' WHERE id = n.id;
      ready := ready + 1;
    ELSE waiting := waiting + 1; END IF;
  END LOOP;
  IF _now >= cutoff THEN
    FOR o IN SELECT x.program_id, coalesce(x.owner_user_id, x.program_id) AS owner_key, min(x.owner_user_id::text)::uuid AS owner_user_id
              FROM public.owner_notifications x
             WHERE x.email_status = 'held' AND NOT x.is_demo AND x.created_at < cutoff
               AND NOT EXISTS (SELECT 1 FROM public.ao_daily_email_items i WHERE i.notification_id = x.id)
               AND NOT EXISTS (SELECT 1 FROM public.ao_owner_email_days d WHERE d.owner_key = coalesce(x.owner_user_id, x.program_id) AND d.day = today)
             GROUP BY 1, 2 LOOP
      SELECT * INTO prog FROM public.owner_programs WHERE id = o.program_id;
      IF NOT coalesce(prog.notify_email, false) THEN
        UPDATE public.owner_notifications SET email_status = 'skipped', delivery_error = 'Homeowner email is off for this program.'
         WHERE program_id = o.program_id AND email_status = 'held';
        CONTINUE;
      END IF;
      nid := gen_random_uuid();
      INSERT INTO public.ao_owner_email_days(owner_key, day, kind, notification_id) VALUES (o.owner_key, today, 'daily', nid)
        ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS got = ROW_COUNT;
      CONTINUE WHEN got = 0;
      SELECT 'Here is what is new in your portal.' || E'\n\n' || string_agg(home_block, E'\n\n' ORDER BY home_sort) INTO body FROM (
        SELECT coalesce(home_label, 'Your homes') AS home_sort,
               coalesce(home_label, 'Your homes') || E'\n' || string_agg('- ' || line, E'\n' ORDER BY created_at) AS home_block
          FROM (
            SELECT x.created_at,
                   (SELECT public.format_property_label(to_jsonb(h)) ->> 'primary' FROM public.properties h WHERE h.id = r.property_id) AS home_label,
                   CASE WHEN x.kind = 'ao_plan_ready' THEN 'Your homeowner plan is ready'
                        WHEN x.kind = 'ao_home_live' THEN 'Your home is live: new activities are in your portal'
                        WHEN x.title LIKE 'Reminder:%' THEN coalesce(r.title, 'An activity') || ' closes soon'
                        ELSE coalesce(r.title, 'An activity') || ' is ready' END AS line
              FROM public.owner_notifications x LEFT JOIN public.owner_reviews r ON r.id = x.review_id
             WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND x.created_at < cutoff
          ) items GROUP BY 1) blocks;
      INSERT INTO public.owner_notifications(id, program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, read_at)
      VALUES (nid, o.program_id, prog.owner_user_id, 'ao_daily', 'p3', 'Your homeowner plan today', body, '/owner', 'pending', 'skipped', now());
      INSERT INTO public.ao_daily_email_items(notification_id, daily_notification_id)
        SELECT x.id, nid FROM public.owner_notifications x
         WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND x.created_at < cutoff;
      UPDATE public.owner_notifications SET email_status = 'in_daily_email'
       WHERE id IN (SELECT notification_id FROM public.ao_daily_email_items WHERE daily_notification_id = nid);
      daily := daily + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('plan_ready_sent', ready, 'plan_ready_waiting', waiting, 'daily_sent', daily);
END $function$;
