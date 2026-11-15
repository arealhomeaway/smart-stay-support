-- Undo ao-guard-engine-fix: restore the three captured steps and N02's prior values, then drop the backup.
CREATE OR REPLACE FUNCTION private.guard_owner_lifecycle_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE trusted boolean:=current_user=(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure);
 changed boolean; review public.owner_reviews; BEGIN
 IF TG_TABLE_NAME='owner_programs' THEN
  IF TG_OP='UPDATE' AND OLD.completion_report IS NOT NULL AND (NEW.completion_report IS DISTINCT FROM OLD.completion_report OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
   OR NEW.completed_by IS DISTINCT FROM OLD.completed_by OR NEW.status IS DISTINCT FROM OLD.status) THEN RAISE EXCEPTION 'The saved closeout report and completed lifecycle are immutable.'; END IF;
  IF TG_OP='UPDATE' AND (NEW.owner_record_id IS DISTINCT FROM OLD.owner_record_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo)
   AND (OLD.owner_record_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_program_events e WHERE e.program_id=OLD.id)) THEN RAISE EXCEPTION 'Preserve the program canonical Owner, original Property and demo identity.'; END IF;
  IF TG_OP='UPDATE' THEN
   changed:=(to_jsonb(NEW)-ARRAY['updated_at','report_version','last_owner_activity_at','notify_email','notify_sms_p1','notify_push','owner_phone','owner_user_id'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','report_version','last_owner_activity_at','notify_email','notify_sms_p1','notify_push','owner_phone','owner_user_id']);
  ELSE changed:=true; END IF;
  IF TG_OP='DELETE' AND NOT(OLD.is_demo AND trusted AND coalesce(public.has_role(auth.uid(),'admin'),false)) THEN RAISE EXCEPTION 'Retain program history; archive through a reviewed lifecycle action.'; END IF;
  IF changed AND NOT trusted THEN RAISE EXCEPTION 'Change owner program lifecycle and setup through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_program_properties' THEN
  IF TG_OP='UPDATE' AND (NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo) THEN RAISE EXCEPTION 'Enrollment identity is immutable. Retain its history.'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Remove enrollment without deleting its history.'; END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change owner enrollment through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_reviews' THEN
  IF TG_OP='UPDATE' AND NEW.auto_ticket IS DISTINCT FROM OLD.auto_ticket THEN RAISE EXCEPTION 'Preserve the published opportunity source and revision model.'; END IF;
  -- Manual/roadmap content is published on insertion and has no revision editor.
  -- Automatic Ticket projections retain their separate immutable update receipts.
  IF TG_OP='UPDATE' AND NOT OLD.auto_ticket AND (
   (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(NEW)) WHERE key=ANY(ARRAY['title','business_question','recommendation','evidence','impact','outcome','photos','attachment_path','owner_action_type','decision_path']))
   IS DISTINCT FROM
   (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(OLD)) WHERE key=ANY(ARRAY['title','business_question','recommendation','evidence','impact','outcome','photos','attachment_path','owner_action_type','decision_path']))
  ) THEN RAISE EXCEPTION 'Published manual opportunity context is immutable. Preserve the narrative the owner reviewed.'; END IF;
  IF TG_OP IN('UPDATE','DELETE') AND (OLD.responded_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_time_entries t WHERE t.review_id=OLD.id)) THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain the opportunity and its participation history.'; END IF;
   IF NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
    OR NEW.onboarding_task_id IS DISTINCT FROM OLD.onboarding_task_id OR NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'The source and Property identity of participated opportunities are immutable.';
   END IF;
  END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change owner opportunities through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_review_properties' THEN
  SELECT * INTO review FROM public.owner_reviews WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.review_id ELSE NEW.review_id END;
  IF review.responded_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_time_entries t WHERE t.review_id=review.id) THEN
   IF TG_OP<>'INSERT' OR NOT EXISTS(SELECT 1 FROM public.owner_review_properties p WHERE p.review_id=NEW.review_id AND p.property_id=NEW.property_id) THEN
    RAISE EXCEPTION 'Retain the Property links of participated opportunities.';
   END IF;
  END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change opportunity Property links through the checked atomic actions.'; END IF;
 ELSE
  IF TG_OP IN('UPDATE','DELETE') THEN RAISE EXCEPTION 'Owner program history is immutable.'; END IF;
  IF NEW.kind IN('program_created','property_added','property_removed','closing_confirmed','program_updated','status_changed','roadmap_seeded','opportunity_created','opportunity_closed','program_completed','program_activated')
   AND NOT trusted THEN RAISE EXCEPTION 'Record lifecycle history through the checked atomic action.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION private.ao_unlock(_plan_card uuid, _actor uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pc public.ao_home_plan_cards; c public.ao_library_cards; start_d date; dl date; flex boolean;
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR pc.join_outcome <> 'locked' OR pc.unlocked_at IS NOT NULL THEN RETURN false; END IF;
  SELECT * INTO c FROM public.ao_library_cards WHERE id = pc.card_id;
  start_d := (now() AT TIME ZONE 'America/Chicago')::date;
  flex := c.lane = 'flexible' OR c.cutoff_rule = 'none';
  -- ao-owner-needed: only owner-needed cards get dates; every other card opens with all four empty.
  dl := CASE WHEN NOT c.owner_needed THEN NULL
             WHEN c.deadline_business_days IS NOT NULL THEN private.ao_add_business_days(start_d, c.deadline_business_days)
             WHEN c.deadline_calendar_days IS NOT NULL THEN start_d + c.deadline_calendar_days END;
  UPDATE public.ao_home_plan_cards SET unlocked_at = now(), unlocked_by = _actor,
    deadline_at = CASE WHEN dl IS NOT NULL THEN private.ao_central(dl, 17) END,
    reminder_at = CASE WHEN dl IS NOT NULL AND NOT flex THEN private.ao_central(private.ao_add_business_days(dl, -1), 17) END,
    cutoff_at = CASE WHEN dl IS NOT NULL AND NOT flex THEN private.ao_central(private.ao_add_business_days(dl, greatest(1, c.cutoff_business_days)), 9) END
  WHERE id = pc.id;
  UPDATE public.owner_reviews SET status = 'awaiting_owner', available_from = now(), respond_by = dl,
    recommendation = c.why_text, updated_at = now()
  WHERE id = pc.owner_review_id;
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.ao_process_clocks(_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; reminders int := 0; expiries int := 0; demo boolean;
BEGIN
  FOR r IN SELECT pc.*, c.title, c.lane, p.owner_user_id, p.is_demo prog_demo, coalesce(pr.is_demo,false) prop_demo
    FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
    JOIN public.owner_programs p ON p.id = pc.program_id JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
    LEFT JOIN public.properties pr ON pr.id = pc.property_id
    WHERE pc.unlocked_at IS NOT NULL AND pc.owner_completed_at IS NULL AND pc.expired_at IS NULL
      AND c.lane <> 'flexible' AND pc.cutoff_at IS NOT NULL
      AND pc.deadline_at IS NOT NULL -- ao-owner-needed: no deadline, no reminder, no expiry, no ARHA takeover
    FOR UPDATE OF pc SKIP LOCKED
  LOOP
    demo := r.prog_demo OR r.prop_demo;
    IF _now >= r.cutoff_at THEN
      UPDATE public.ao_home_plan_cards SET expired_at = _now WHERE id = r.id;
      UPDATE public.owner_reviews SET status = 'closed', closed_at = _now, outcome = 'Owner opportunity expired, ARHA completed', updated_at = _now
        WHERE id = r.owner_review_id;
      INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, email_status, is_demo)
        SELECT t.assigned_to, 'ao_card_expired', 'Homeowner did not complete ' || r.title || '; proceed as normal', '',
               'onboarding_task', t.id, 'none', demo
        FROM public.onboarding_tasks t WHERE t.id = r.linked_task_id AND t.assigned_to IS NOT NULL;
      expiries := expiries + 1;
    ELSIF r.reminder_at IS NOT NULL AND _now >= r.reminder_at AND r.reminder_sent_at IS NULL THEN
      UPDATE public.ao_home_plan_cards SET reminder_sent_at = _now WHERE id = r.id;
      -- existing owner alert path: in-app for every member, email to the main homeowner via existing delivery rules
      INSERT INTO public.owner_notifications(program_id, owner_user_id, review_id, kind, priority, title, body, email_status, is_demo)
        VALUES (r.program_id, r.owner_user_id, r.owner_review_id, 'review_ready', 'p3', 'Reminder: ' || r.title,
                'This item closes soon.', CASE WHEN demo THEN 'skipped' ELSE 'pending' END, demo);
      reminders := reminders + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reminders', reminders, 'expired', expiries);
END $function$;

DO $undo$
BEGIN
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  UPDATE public.ao_home_plan_cards pc SET join_outcome = b.before_value->>'join_outcome',
         unlocked_at = (b.before_value->>'unlocked_at')::timestamptz, unlocked_by = (b.before_value->>'unlocked_by')::uuid
    FROM private.ao_n02_relock_backup_20261115 b WHERE b.kind = 'plan_card_relock' AND pc.id = b.row_id;
  UPDATE public.owner_reviews o SET status = b.before_value->>'status', available_from = (b.before_value->>'available_from')::timestamptz
    FROM private.ao_n02_relock_backup_20261115 b WHERE b.kind = 'review_relock' AND o.id = b.row_id;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
END $undo$;
DROP TABLE private.ao_n02_relock_backup_20261115;
