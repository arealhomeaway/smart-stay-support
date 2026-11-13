-- Undo for Property page Part 2 (apply.sql). Restores the live ao_owner_email_run, removes the
-- new trigger, functions, tables and columns. Run only if apply.sql was applied and must be reversed.
-- Data written by the new tables (chat messages, weekly updates, reminders, Good to know, logged
-- calls) is removed with them; export those tables first if anything must be kept.

DROP TRIGGER IF EXISTS bulk_task_notices_in_app_only ON public.staff_notifications;
DROP FUNCTION IF EXISTS public.bulk_task_notices_in_app_only();

ALTER PUBLICATION supabase_realtime DROP TABLE public.home_chat_messages;

DROP FUNCTION IF EXISTS public.set_owner_item_due(uuid, date);
DROP FUNCTION IF EXISTS public.owner_decision_reminder_run(timestamptz);
DROP FUNCTION IF EXISTS public.prev_business_day(date);
DROP TABLE IF EXISTS public.owner_decision_reminders;

DROP FUNCTION IF EXISTS public.set_weekly_update_switch(uuid, boolean, boolean);
DROP FUNCTION IF EXISTS public.save_weekly_update_text(uuid, text);
DROP FUNCTION IF EXISTS public.send_weekly_update(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.weekly_update_may_send(uuid, uuid);
DROP FUNCTION IF EXISTS public.weekly_update_send_internal(uuid, text, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS public.weekly_update_send_closed(timestamptz);
DROP TABLE IF EXISTS public.owner_weekly_update_events;
DROP TABLE IF EXISTS public.owner_weekly_update_settings;
DROP TABLE IF EXISTS public.owner_weekly_updates;

DROP FUNCTION IF EXISTS public.log_owner_contact(uuid, text, text);
DROP TRIGGER IF EXISTS guard_onboarding_note_kind ON public.onboarding_notes;
DROP FUNCTION IF EXISTS public.guard_onboarding_note_kind();
ALTER TABLE public.onboarding_notes DROP CONSTRAINT IF EXISTS onboarding_notes_kind_check;
ALTER TABLE public.onboarding_notes DROP COLUMN IF EXISTS kind;

DROP FUNCTION IF EXISTS public.set_owner_team_notes(uuid, text);
DROP TRIGGER IF EXISTS guard_owner_team_notes ON public.property_owners;
DROP FUNCTION IF EXISTS public.guard_owner_team_notes();
DROP TABLE IF EXISTS public.property_owner_team_note_events;
ALTER TABLE public.property_owners DROP COLUMN IF EXISTS team_notes_updated_by;
ALTER TABLE public.property_owners DROP COLUMN IF EXISTS team_notes_updated_at;
ALTER TABLE public.property_owners DROP COLUMN IF EXISTS team_notes;

DROP FUNCTION IF EXISTS public.home_chat_unread_alert_run(timestamptz);
DROP FUNCTION IF EXISTS public.my_home_chat_inbox();
DROP FUNCTION IF EXISTS public.link_chat_message_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.mark_home_chat_read(uuid);
DROP FUNCTION IF EXISTS public.post_home_chat_message(uuid, text, text, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.home_chat_team_recipients(uuid);
DROP FUNCTION IF EXISTS public.home_chat_notify(uuid[], uuid, text, text, text, uuid, text, boolean);
DROP TABLE IF EXISTS public.home_chat_alerts;
DROP TABLE IF EXISTS public.home_chat_message_tasks;
DROP TABLE IF EXISTS public.home_chat_reads;
DROP TABLE IF EXISTS public.home_chat_messages;
DROP FUNCTION IF EXISTS public.home_chat_can_read(uuid, uuid);
DROP TABLE IF EXISTS public.home_chats;

DROP FUNCTION IF EXISTS public.home_owner_contact_writer(uuid, uuid);
DROP FUNCTION IF EXISTS public.home_owner_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.home_lead(uuid);
DROP FUNCTION IF EXISTS public.home_pm(uuid, uuid);
DROP FUNCTION IF EXISTS public.home_team_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.home_chat_staff(uuid);

-- Restore the live daily owner email exactly as captured.
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
