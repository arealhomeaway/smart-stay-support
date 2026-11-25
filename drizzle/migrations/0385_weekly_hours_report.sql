CREATE TABLE public.ao_hours_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  notification_id uuid,
  portal_notification_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, week_start)
);
CREATE TABLE public.ao_hours_report_homes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.ao_hours_reports(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  sent_text text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, property_id)
);
CREATE TABLE public.ao_hours_report_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  held_by uuid NOT NULL,
  held_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, week_start)
);
CREATE TABLE public.ao_hours_report_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edited_by uuid NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  before_value jsonb,
  after_value jsonb NOT NULL
);

GRANT SELECT ON public.ao_hours_reports, public.ao_hours_report_homes, public.ao_hours_report_holds, public.ao_hours_report_edits TO authenticated;
GRANT ALL ON public.ao_hours_reports, public.ao_hours_report_homes, public.ao_hours_report_holds, public.ao_hours_report_edits TO service_role;
ALTER TABLE public.ao_hours_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_hours_report_homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_hours_report_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_hours_report_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read hours reports" ON public.ao_hours_reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff read hours report homes" ON public.ao_hours_report_homes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff read hours report holds" ON public.ao_hours_report_holds FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin reads hours report edits" ON public.ao_hours_report_edits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin only: schedule and wording, with who and when.
CREATE FUNCTION public.save_ao_hours_report_settings(_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prev jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only an Admin can change the weekly hours report.'; END IF;
  SELECT value INTO prev FROM public.app_settings WHERE key = 'ao_hours_report' FOR UPDATE;
  INSERT INTO public.app_settings(key, value, updated_by, updated_at) VALUES ('ao_hours_report', _value, auth.uid(), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.ao_hours_report_edits(edited_by, before_value, after_value) VALUES (auth.uid(), prev, _value);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.save_ao_hours_report_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_ao_hours_report_settings(jsonb) TO authenticated;

-- Staff: skip this home's next send only.
CREATE FUNCTION public.hold_ao_hours_report(_property_id uuid, _week_start date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE got int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can hold the hours report.'; END IF;
  INSERT INTO public.ao_hours_report_holds(property_id, week_start, held_by) VALUES (_property_id, _week_start, auth.uid())
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS got = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'already', got = 0);
END $$;
REVOKE ALL ON FUNCTION public.hold_ao_hours_report(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hold_ao_hours_report(uuid, date) TO authenticated;

-- The scheduled job only: one report per program per week. Email to the main homeowner is held for the
-- daily run; the portal copy is one program notification every co-owner sees; each home keeps the text.
CREATE FUNCTION public.ao_record_hours_report(_program_id uuid, _week_start date, _subject text, _body text, _property_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rid uuid; prog public.owner_programs; eid uuid; pid uuid;
BEGIN
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program_id;
  IF prog.id IS NULL OR prog.is_demo OR prog.status IN ('closed', 'archived') OR prog.archived_at IS NOT NULL THEN RETURN NULL; END IF;
  INSERT INTO public.ao_hours_reports(program_id, week_start, subject, body) VALUES (_program_id, _week_start, _subject, _body)
    ON CONFLICT DO NOTHING RETURNING id INTO rid;
  IF rid IS NULL THEN RETURN NULL; END IF;
  IF coalesce(prog.notify_email, false) THEN
    INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, read_at)
      VALUES (_program_id, prog.owner_user_id, 'ao_hours_report', 'p3', _subject, _body, '/owner', 'held', 'skipped', now()) RETURNING id INTO eid;
  END IF;
  INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
    VALUES (_program_id, prog.owner_user_id, 'ao_hours_report_portal', 'p3', _subject, _body, '/owner', 'skipped', 'skipped')
    RETURNING id INTO pid;
  UPDATE public.ao_hours_reports SET notification_id = eid, portal_notification_id = pid WHERE id = rid;
  INSERT INTO public.ao_hours_report_homes(report_id, property_id, sent_text)
    SELECT rid, p, _body FROM unnest(_property_ids) p ON CONFLICT DO NOTHING;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.ao_record_hours_report(uuid, date, text, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ao_record_hours_report(uuid, date, text, text, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.ao_owner_email_run(_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n record; o record; got int; ready int := 0; daily int := 0; waiting int := 0;
  today date := (_now AT TIME ZONE 'America/Chicago')::date;
  cutoff timestamptz := (today + private.ao_digest_time()) AT TIME ZONE 'America/Chicago';
  body text; nid uuid; prog public.owner_programs; rep record; nkind text; ntitle text;
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
             WHERE x.email_status = 'held' AND NOT x.is_demo AND (x.created_at < cutoff OR x.kind IN ('owner_decision_reminder', 'ao_hours_report'))
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
      -- Weekly hours report (Nov 25): its own section at the top of the same one email, or alone.
      SELECT x.title, x.body INTO rep FROM public.owner_notifications x
       WHERE x.program_id = o.program_id AND x.kind = 'ao_hours_report' AND x.email_status = 'held' AND NOT x.is_demo
       ORDER BY x.created_at DESC LIMIT 1;
      SELECT 'Here is what is new in your portal.' || E'\n\n' || string_agg(home_block, E'\n\n' ORDER BY home_sort) INTO body FROM (
        SELECT coalesce(home_label, 'Your homes') AS home_sort,
               coalesce(home_label, 'Your homes') || E'\n' || string_agg('- ' || line, E'\n' ORDER BY created_at) AS home_block
          FROM (
            SELECT x.created_at,
                   (SELECT public.format_property_label(to_jsonb(h)) ->> 'primary' FROM public.properties h WHERE h.id = r.property_id) AS home_label,
                   CASE WHEN x.kind = 'ao_plan_ready' THEN 'Your homeowner plan is ready'
                        WHEN x.kind = 'ao_home_live' THEN 'Your home is live: new activities are in your portal'
                        WHEN x.kind = 'owner_decision_reminder' THEN x.title
                        WHEN x.title LIKE 'Reminder:%' THEN coalesce(r.title, 'An activity') || ' closes soon'
                        ELSE coalesce(r.title, 'An activity') || ' is ready' END AS line
              FROM public.owner_notifications x LEFT JOIN public.owner_reviews r ON r.id = x.review_id
             WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND x.kind <> 'ao_hours_report' AND (x.created_at < cutoff OR x.kind = 'owner_decision_reminder')
          ) items GROUP BY 1) blocks;
      IF rep.title IS NOT NULL THEN
        body := rep.body || CASE WHEN body IS NULL THEN '' ELSE E'\n\n' || body END;
        nkind := 'ao_hours_email'; ntitle := rep.title;
      ELSE nkind := 'ao_daily'; ntitle := 'Your homeowner plan today'; END IF;
      INSERT INTO public.owner_notifications(id, program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, read_at)
      VALUES (nid, o.program_id, prog.owner_user_id, nkind, 'p3', ntitle, body, '/owner', 'pending', 'skipped', now());
      INSERT INTO public.ao_daily_email_items(notification_id, daily_notification_id)
        SELECT x.id, nid FROM public.owner_notifications x
         WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND (x.created_at < cutoff OR x.kind IN ('owner_decision_reminder', 'ao_hours_report'));
      UPDATE public.owner_notifications SET email_status = 'in_daily_email'
       WHERE id IN (SELECT notification_id FROM public.ao_daily_email_items WHERE daily_notification_id = nid);
      daily := daily + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('plan_ready_sent', ready, 'plan_ready_waiting', waiting, 'daily_sent', daily);
END $function$;