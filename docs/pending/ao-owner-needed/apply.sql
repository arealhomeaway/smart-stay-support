-- ao-owner-needed (approved by the Admin, Nov 15 2026): only 15 owner-needed cards get deadlines;
-- cards that wait for team work stay locked on every home; fix the homes already switched on.
-- One transaction (the migration runner supplies it). Sends no email or notice.

-- 1. Preflight: refuse if anything moved since the Nov 15 capture.
DO $pre$
DECLARE bad text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ao_library_cards' AND column_name = 'owner_needed') THEN
    RAISE EXCEPTION 'Changed since Nov 15: ao_library_cards.owner_needed already exists. Nothing was changed.';
  END IF;
  SELECT string_agg(f, ', ') INTO bad FROM (VALUES
      ('private', 'ao_unlock', '306e6a849b808a1410923c4a759fffa2'),
      ('private', 'ao_plan_outcomes', '6e9836492b924d5c031ec26ab2f96c4b'),
      ('private', 'ao_ops_card_rule', 'c9c6f854133ab2856001e3852d9bfbcc'),
      ('private', 'ao_on_handoff', 'e169cb4fca408e7a3e6310eeddb77ebb'),
      ('public', 'ao_process_clocks', '5c370340180f4ebe8703ee52bcd68840')) v(s, f, h)
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = v.s AND p.proname = v.f AND md5(p.prosrc) = v.h);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Changed since Nov 15: %. Nothing was changed.', bad; END IF;
  IF (SELECT count(*) FROM public.ao_library_cards WHERE code IN
      ('A22','A24','A40','P01','P02','A03','A25','A26','A27','A28','A30','A39','A58','P03','P04')) <> 15 THEN
    RAISE EXCEPTION 'Changed since Nov 15: the 15 owner-needed card codes are not all in the library. Nothing was changed.';
  END IF;
END $pre$;

-- 2. Item 1: which cards the owner must finish on time.
ALTER TABLE public.ao_library_cards ADD COLUMN owner_needed boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.ao_library_cards.owner_needed IS 'True only for cards the homeowner must finish on time; only these get a deadline, reminder and cutoff when they open.';
UPDATE public.ao_library_cards SET owner_needed = true
 WHERE code IN ('A22','A24','A40','P01','P02','A03','A25','A26','A27','A28','A30','A39','A58','P03','P04');

-- 3. Item 2: a card gets deadline, reminder, cutoff and respond_by only when owner_needed. Every open path
-- (plan start, Task done, Unlock now, handoff) goes through this one function.
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

-- 4. Item 2: the five-minute clock never reminds, expires or hands a card to ARHA without a deadline.
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

-- 5. Item 3: A33 and N10 no longer open at handoff; they stay locked like the other team-work cards.
-- A14 and A35 keep waiting for Operations data (A51 keeps its existing rule in ao_plan_outcomes).
CREATE OR REPLACE FUNCTION private.ao_ops_card_rule(_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN _code IN ('A33', 'N10') THEN 'stays_locked'
              WHEN _code IN ('A14', 'A35') THEN 'waits_for_bridge' END
$function$;

-- 6. Item 3: a team-work card opens only when its linked Task is done or staff press Unlock now,
-- on onboarding and live homes alike. The live-home "no step, so open" rule is removed.
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
      -- ao-owner-needed: A33 and N10 stay locked until staff press Unlock now.
      WHEN ops = 'stays_locked' THEN CASE WHEN cov IS NOT NULL THEN 'already_covered' ELSE 'locked' END
      WHEN stage = 'operations' AND c.stage_window = 'operations' AND c.lock_rule = 'until_linked_step_done' AND t_id IS NULL THEN 'not_added'
      WHEN stage = 'operations' AND c.stage_window NOT IN ('operations', 'anytime') THEN 'skipped_passed'
      -- File 07: on a home still in onboarding, a card is never skipped because a date passed; it follows its step.
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(t_done, false) THEN 'locked'
      ELSE 'open' END;
    IF res IN ('locked', 'open') AND t_id IS NOT NULL THEN claimed := claimed || t_id; END IF;
    card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := res; task_id := t_id; coverage := cov;
    RETURN NEXT;
  END LOOP;
END $function$;

-- 7. Item 3: handoff opens nothing by itself; an operations card not yet on the plan is added with its
-- normal outcome, so A33 and N10 are added locked.
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
  FOR r IN SELECT * FROM private.ao_plan_outcomes(_property) o
            WHERE o.stage_window = 'operations' AND private.ao_ops_card_rule(o.code) IS DISTINCT FROM 'waits_for_bridge'
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
END $function$;

-- 8. Item 4: fix the homes already switched on. Prior values are kept for the undo.
CREATE TABLE private.ao_owner_needed_backup_20261115 (
  kind text NOT NULL, row_id uuid NOT NULL, property_id uuid, code text, before_value jsonb NOT NULL,
  PRIMARY KEY (kind, row_id));
REVOKE ALL ON private.ao_owner_needed_backup_20261115 FROM PUBLIC;

DO $fix$
DECLARE homes jsonb; dated int; relocked int;
BEGIN
  PERFORM set_config('resolve.owner_release_batch', 'on', true); -- belt and braces: no owner notice from this fix

  -- 8a. Open cards that are not owner-needed and not finished by the owner: clear all four dates.
  CREATE TEMP TABLE ao_fix_dates ON COMMIT DROP AS
    SELECT pc.id, pc.property_id, pc.owner_review_id, c.code
      FROM public.ao_home_plan_cards pc
      JOIN public.ao_library_cards c ON c.id = pc.card_id
      JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
      LEFT JOIN public.owner_reviews o ON o.id = pc.owner_review_id
     WHERE NOT c.owner_needed
       AND pc.unlocked_at IS NOT NULL AND pc.owner_completed_at IS NULL AND pc.expired_at IS NULL
       AND o.responded_at IS NULL
       AND (pc.deadline_at IS NOT NULL OR pc.reminder_at IS NOT NULL OR pc.cutoff_at IS NOT NULL OR o.respond_by IS NOT NULL);
  INSERT INTO private.ao_owner_needed_backup_20261115(kind, row_id, property_id, code, before_value)
    SELECT 'plan_card_dates', pc.id, pc.property_id, f.code,
           jsonb_build_object('deadline_at', pc.deadline_at, 'reminder_at', pc.reminder_at, 'cutoff_at', pc.cutoff_at)
      FROM ao_fix_dates f JOIN public.ao_home_plan_cards pc ON pc.id = f.id;
  INSERT INTO private.ao_owner_needed_backup_20261115(kind, row_id, property_id, code, before_value)
    SELECT 'review_respond_by', o.id, f.property_id, f.code, jsonb_build_object('respond_by', o.respond_by)
      FROM ao_fix_dates f JOIN public.owner_reviews o ON o.id = f.owner_review_id WHERE o.respond_by IS NOT NULL;
  UPDATE public.ao_home_plan_cards pc SET deadline_at = NULL, reminder_at = NULL, cutoff_at = NULL
    FROM ao_fix_dates f WHERE pc.id = f.id;
  UPDATE public.owner_reviews o SET respond_by = NULL
    FROM ao_fix_dates f WHERE o.id = f.owner_review_id AND o.respond_by IS NOT NULL;

  -- 8b. A33 and N10 back to locked on the three named homes, only where the owner has not started them.
  CREATE TEMP TABLE ao_fix_relock ON COMMIT DROP AS
    SELECT pc.id, pc.property_id, pc.owner_review_id, c.code
      FROM public.ao_home_plan_cards pc
      JOIN public.ao_library_cards c ON c.id = pc.card_id
      JOIN public.properties h ON h.id = pc.property_id
      LEFT JOIN public.owner_reviews o ON o.id = pc.owner_review_id
     WHERE c.code IN ('A33', 'N10')
       AND h.id IN ('bacd3693-5a52-4ec0-a560-1281aadac37e',  -- 1399 Foxtail Ln
                    '9de75678-9e34-4219-a186-ed0da15f0092',  -- 3915 W 104th St S
                    '79319968-80c9-4f00-b6c9-608c0b1881dc')  -- 9211 Fitzgerald Dr
       AND pc.join_outcome = 'open' AND pc.unlocked_at IS NOT NULL
       AND pc.owner_completed_at IS NULL AND pc.expired_at IS NULL
       AND o.responded_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.ao_contributions x WHERE x.plan_card_id = pc.id)
       AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries t WHERE t.review_id = pc.owner_review_id)
       AND NOT EXISTS (SELECT 1 FROM public.owner_request_messages m WHERE m.review_id = pc.owner_review_id);
  INSERT INTO private.ao_owner_needed_backup_20261115(kind, row_id, property_id, code, before_value)
    SELECT 'plan_card_relock', pc.id, pc.property_id, f.code,
           jsonb_build_object('join_outcome', pc.join_outcome, 'unlocked_at', pc.unlocked_at, 'unlocked_by', pc.unlocked_by)
      FROM ao_fix_relock f JOIN public.ao_home_plan_cards pc ON pc.id = f.id;
  INSERT INTO private.ao_owner_needed_backup_20261115(kind, row_id, property_id, code, before_value)
    SELECT 'review_relock', o.id, f.property_id, f.code, jsonb_build_object('status', o.status, 'available_from', o.available_from)
      FROM ao_fix_relock f JOIN public.owner_reviews o ON o.id = f.owner_review_id;
  UPDATE public.ao_home_plan_cards pc SET join_outcome = 'locked', unlocked_at = NULL, unlocked_by = NULL
    FROM ao_fix_relock f WHERE pc.id = f.id;
  UPDATE public.owner_reviews o SET status = 'prepared', available_from = NULL
    FROM ao_fix_relock f WHERE o.id = f.owner_review_id;

  PERFORM set_config('resolve.owner_release_batch', 'off', true);

  SELECT count(*) INTO dated FROM ao_fix_dates;
  SELECT count(*) INTO relocked FROM ao_fix_relock;
  SELECT jsonb_object_agg(h.name, jsonb_build_object(
           'plan_cards_dates_cleared', (SELECT count(*) FROM ao_fix_dates f WHERE f.property_id = h.id),
           'respond_by_cleared', (SELECT count(*) FROM private.ao_owner_needed_backup_20261115 b WHERE b.kind = 'review_respond_by' AND b.property_id = h.id),
           'cards_relocked', (SELECT count(*) FROM ao_fix_relock f WHERE f.property_id = h.id),
           'reviews_back_to_prepared', (SELECT count(*) FROM private.ao_owner_needed_backup_20261115 b WHERE b.kind = 'review_relock' AND b.property_id = h.id)))
    INTO homes
    FROM public.properties h JOIN public.ao_home_plan_settings s ON s.property_id = h.id AND s.automated;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_owner_needed_applied', 'function', 'Active Owner: owner-needed deadlines',
    'docs/pending/ao-owner-needed/apply.sql (approved by the Admin, Nov 15): owner_needed on 15 cards; deadlines only for those; '
    || 'team-work cards stay locked on every home; A33 and N10 no longer open at handoff; switched-on homes fixed. No email or notice sent. '
    || 'Undo: docs/pending/ao-owner-needed/apply.undo.sql (prior values in private.ao_owner_needed_backup_20261115).',
    NULL,
    jsonb_build_object('owner_needed_cards', (SELECT count(*) FROM public.ao_library_cards WHERE owner_needed),
                       'plan_cards_dates_cleared', dated, 'cards_relocked', relocked, 'per_home', homes));
END $fix$;
