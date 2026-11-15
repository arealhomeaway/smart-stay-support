-- Undo for ao-owner-needed. Restores the five engine steps exactly as captured live on Nov 15,
-- puts back every date and lock state the fix changed, then removes owner_needed.
-- Sends no email or notice (owner release batch flag is on while reviews go back to awaiting_owner).
DO $pre$ BEGIN
  IF to_regclass('private.ao_owner_needed_backup_20261115') IS NULL THEN
    RAISE EXCEPTION 'ao-owner-needed is not applied. Nothing was changed.';
  END IF;
END $pre$;

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
  dl := CASE WHEN c.deadline_business_days IS NOT NULL THEN private.ao_add_business_days(start_d, c.deadline_business_days)
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
END $function$

;

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
    ELSIF _now >= r.reminder_at AND r.reminder_sent_at IS NULL THEN
      UPDATE public.ao_home_plan_cards SET reminder_sent_at = _now WHERE id = r.id;
      -- existing owner alert path: in-app for every member, email to the main homeowner via existing delivery rules
      INSERT INTO public.owner_notifications(program_id, owner_user_id, review_id, kind, priority, title, body, email_status, is_demo)
        VALUES (r.program_id, r.owner_user_id, r.owner_review_id, 'review_ready', 'p3', 'Reminder: ' || r.title,
                'This item closes soon.', CASE WHEN demo THEN 'skipped' ELSE 'pending' END, demo);
      reminders := reminders + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reminders', reminders, 'expired', expiries);
END $function$

;

CREATE OR REPLACE FUNCTION private.ao_ops_card_rule(_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN _code IN ('A33', 'N10') THEN 'opens_at_handoff'
              WHEN _code IN ('A14', 'A35') THEN 'waits_for_bridge' END
$function$

;

CREATE OR REPLACE FUNCTION private.ao_plan_outcomes(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS TABLE(card_id uuid, code text, stage_window text, outcome text, task_id uuid, coverage jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE stage text := private.ao_home_stage(_property); c public.ao_library_cards; t_id uuid; t_done boolean;
  cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; res text; ops text;
BEGIN
  FOR c IN SELECT l.* FROM public.ao_library_cards l WHERE l.status = 'released' ORDER BY l.code LOOP
    IF EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.property_id = _property AND pc.card_id = c.id) THEN
      card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := 'already_on_plan'; task_id := NULL; coverage := NULL;
      RETURN NEXT; CONTINUE;
    END IF;
    t_id := NULL; t_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO t_id, t_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason', 'staff_marked');
    ELSIF t_id IS NOT NULL AND t_id = ANY (claimed) THEN cov := jsonb_build_object('reason', 'same_task_other_card');
    ELSE cov := private.ao_card_coverage(_property, c.code, t_id); END IF;
    IF cov IS NULL AND coalesce(t_done, false) THEN cov := jsonb_build_object('reason', 'linked_task_done', 'source', 'onboarding_task', 'item_id', t_id); END IF;
    ops := CASE WHEN stage = 'operations' AND c.stage_window = 'operations' THEN private.ao_ops_card_rule(c.code) END;
    res := CASE
      WHEN ops = 'waits_for_bridge' THEN 'not_added'
      WHEN ops = 'opens_at_handoff' THEN CASE WHEN cov IS NOT NULL THEN 'already_covered' ELSE 'open' END
      WHEN stage = 'operations' AND c.stage_window = 'operations' AND c.lock_rule = 'until_linked_step_done' AND t_id IS NULL THEN 'not_added'
      WHEN stage = 'operations' AND c.stage_window NOT IN ('operations', 'anytime') THEN 'skipped_passed'
      -- File 07: on a home still in onboarding, a card is never skipped because a date passed; it follows its step.
      WHEN cov IS NOT NULL THEN 'already_covered'
      -- File 07: on a live home, an optional card whose step no longer exists opens.
      WHEN stage = 'operations' AND c.stage_window = 'anytime' AND t_id IS NULL THEN 'open'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(t_done, false) THEN 'locked'
      ELSE 'open' END;
    IF res IN ('locked', 'open') AND t_id IS NOT NULL THEN claimed := claimed || t_id; END IF;
    card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := res; task_id := t_id; coverage := cov;
    RETURN NEXT;
  END LOOP;
END $function$

;

CREATE OR REPLACE FUNCTION private.ao_on_handoff(_property uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hp jsonb; prog uuid; pc public.ao_home_plan_cards; c public.ao_library_cards; r record; opened int := 0; added int := 0; cov jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings WHERE property_id = _property AND automated) THEN RETURN NULL; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN RETURN hp; END IF;
  prog := (hp ->> 'program_id')::uuid;
  PERFORM set_config('app.ao_engine', 'on', true);
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' AND private.ao_ops_card_rule(code) = 'opens_at_handoff' ORDER BY code LOOP
    SELECT * INTO pc FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id;
    IF FOUND THEN
      IF pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL AND private.ao_unlock(pc.id, _actor) THEN opened := opened + 1; END IF;
    ELSE
      cov := private.ao_card_coverage(_property, c.code, NULL);
      PERFORM private.ao_add_plan_card(_property, prog, c.id, CASE WHEN cov IS NULL THEN 'open' ELSE 'already_covered' END, NULL, cov, _actor);
      IF cov IS NULL THEN opened := opened + 1; END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM private.ao_plan_outcomes(_property) o
            WHERE o.stage_window = 'operations' AND private.ao_ops_card_rule(o.code) IS NULL
              AND o.outcome NOT IN ('already_on_plan', 'not_added') LOOP
    PERFORM private.ao_add_plan_card(_property, prog, r.card_id, r.outcome, r.task_id, r.coverage, _actor);
    IF r.outcome = 'open' THEN added := added + 1; END IF;
  END LOOP;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  PERFORM set_config('app.ao_engine', '', true);
  IF opened + added > 0 THEN
    PERFORM private.ao_owner_email_now(prog, 'ao_home_live', 'Your home is live: new activities are in your portal.',
      'Open your portal to see what''s next.');
  END IF;
  RETURN jsonb_build_object('opened', opened, 'added', added);
END $function$

;

DO $undo$
BEGIN
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  UPDATE public.ao_home_plan_cards pc SET deadline_at = (b.before_value ->> 'deadline_at')::timestamptz,
         reminder_at = (b.before_value ->> 'reminder_at')::timestamptz, cutoff_at = (b.before_value ->> 'cutoff_at')::timestamptz
    FROM private.ao_owner_needed_backup_20261115 b WHERE b.kind = 'plan_card_dates' AND pc.id = b.row_id;
  UPDATE public.owner_reviews o SET respond_by = (b.before_value ->> 'respond_by')::date
    FROM private.ao_owner_needed_backup_20261115 b WHERE b.kind = 'review_respond_by' AND o.id = b.row_id;
  UPDATE public.ao_home_plan_cards pc SET join_outcome = b.before_value ->> 'join_outcome',
         unlocked_at = (b.before_value ->> 'unlocked_at')::timestamptz, unlocked_by = (b.before_value ->> 'unlocked_by')::uuid
    FROM private.ao_owner_needed_backup_20261115 b WHERE b.kind = 'plan_card_relock' AND pc.id = b.row_id;
  UPDATE public.owner_reviews o SET status = b.before_value ->> 'status',
         available_from = (b.before_value ->> 'available_from')::timestamptz
    FROM private.ao_owner_needed_backup_20261115 b WHERE b.kind = 'review_relock' AND o.id = b.row_id;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_owner_needed_undone', 'function', 'Active Owner: owner-needed deadlines',
    'docs/pending/ao-owner-needed/apply.undo.sql: engine steps, dates and lock states restored; owner_needed removed.');
END $undo$;

ALTER TABLE public.ao_library_cards DROP COLUMN owner_needed;
DROP TABLE private.ao_owner_needed_backup_20261115;
