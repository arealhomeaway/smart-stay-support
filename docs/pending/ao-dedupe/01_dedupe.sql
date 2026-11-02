-- Active Owner card de-duplication. Build by Emily's approval of 2026-11-02.
-- Adds new tables and functions, two nullable/defaulted columns on ao_home_plan_cards, two on
-- after_handoff_plan_items, and two BEFORE INSERT guard triggers. Replaces exactly three live functions
-- (ao_set_home_automation, ao_preview_home_automation, private.schedule_after_handoff); their live text
-- and ACLs are in live-capture/ and undo.sql restores them byte for byte.
-- HARD RULE: never inserts, updates or deletes onboarding templates, versions, steps, home plans or Tasks.
-- Seeds only suggestion rows (status suggested). Only confirmed map entries count.

-- 1. Tables ---------------------------------------------------------------------------------------
CREATE TABLE public.ao_card_item_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_kind text NOT NULL CHECK (match_kind IN ('title_pattern','template_id')),
  match_value text NOT NULL CHECK (length(btrim(match_value)) > 0),
  card_code text NOT NULL,
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','confirmed','rejected')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid, decided_at timestamptz,
  UNIQUE (match_kind, match_value, card_code)
);
CREATE TABLE public.ao_card_step_link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_code text NOT NULL,
  suggestion_kind text NOT NULL CHECK (suggestion_kind IN ('link','lock')),
  template_task_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  proposed_lock text CHECK (proposed_lock IN ('open_day_one','unlock_now_only')),
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low')),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid, decided_at timestamptz,
  CHECK ((suggestion_kind = 'link' AND cardinality(template_task_ids) > 0 AND proposed_lock IS NULL)
      OR (suggestion_kind = 'lock' AND proposed_lock IS NOT NULL))
);
CREATE TABLE public.ao_one_off_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  task_id uuid,
  title_key text NOT NULL DEFAULT '',
  confirmed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE TABLE public.ao_dedupe_events (
  id bigserial PRIMARY KEY,
  subject text NOT NULL,
  subject_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ao_home_plan_cards
  ADD COLUMN covered_reason text,
  ADD COLUMN covered_source text,
  ADD COLUMN covered_item_id uuid;
ALTER TABLE public.after_handoff_plan_items
  ADD COLUMN coverage text NOT NULL DEFAULT 'send',
  ADD COLUMN covered_card_code text,
  ADD CONSTRAINT after_handoff_plan_items_coverage_chk CHECK (
    (coverage = 'send' AND covered_card_code IS NULL) OR (coverage = 'covered_by_card' AND covered_card_code IS NOT NULL));

GRANT SELECT ON public.ao_card_item_map, public.ao_card_step_link_suggestions, public.ao_one_off_confirmations, public.ao_dedupe_events TO authenticated;
GRANT ALL ON public.ao_card_item_map, public.ao_card_step_link_suggestions, public.ao_one_off_confirmations, public.ao_dedupe_events TO service_role;
GRANT USAGE ON SEQUENCE public.ao_dedupe_events_id_seq TO service_role;
ALTER TABLE public.ao_card_item_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_card_step_link_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_one_off_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_dedupe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ao_map_staff_read ON public.ao_card_item_map FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY ao_link_sugg_staff_read ON public.ao_card_step_link_suggestions FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY ao_one_off_staff_read ON public.ao_one_off_confirmations FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY ao_dedupe_events_staff_read ON public.ao_dedupe_events FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

-- 2. Shared matching helpers ------------------------------------------------------------------------
CREATE FUNCTION private.ao_title_key(_t text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT lower(btrim(regexp_replace(coalesce(_t,''), '\s+', ' ', 'g'))) $$;

-- Why a card is already covered for a home, or NULL. Live items only (not archived, not withdrawn).
CREATE FUNCTION private.ao_card_coverage(_property uuid, _code text, _task uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF _task IS NOT NULL THEN
    SELECT o.id, o.title INTO r FROM public.owner_reviews o
      WHERE o.onboarding_task_id = _task AND o.archived_at IS NULL ORDER BY o.created_at LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('reason','linked_task','source','owner_review','item_id',r.id,'item_title',r.title); END IF;
    SELECT w.id, w.title INTO r FROM public.work_items w
      WHERE w.kind = 'opportunity' AND (w.source_task_id = _task OR w.linked_task_id = _task)
        AND w.retired_at IS NULL AND w.status <> 'archived' ORDER BY w.created_at LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('reason','linked_task','source','work_item','item_id',r.id,'item_title',r.title); END IF;
  END IF;
  SELECT o.id, o.title, m.id AS map_id INTO r FROM public.owner_reviews o
    JOIN public.ao_card_item_map m ON m.card_code = _code AND m.status = 'confirmed'
      AND ((m.match_kind = 'template_id' AND o.template_id::text = m.match_value)
        OR (m.match_kind = 'title_pattern' AND o.title ILIKE m.match_value))
    WHERE o.archived_at IS NULL
      AND (o.property_id = _property OR (o.property_id IS NULL AND EXISTS (
            SELECT 1 FROM public.owner_programs p WHERE p.id = o.program_id AND p.property_id = _property)))
      AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.owner_review_id = o.id)
    ORDER BY o.created_at LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('reason','confirmed_map','source','owner_review','item_id',r.id,'item_title',r.title,'map_id',r.map_id); END IF;
  SELECT w.id, w.title, m.id AS map_id INTO r FROM public.work_items w
    JOIN public.ao_card_item_map m ON m.card_code = _code AND m.status = 'confirmed'
      AND ((m.match_kind = 'template_id' AND w.library_template_id::text = m.match_value)
        OR (m.match_kind = 'title_pattern' AND w.title ILIKE m.match_value))
    WHERE w.kind = 'opportunity' AND w.property_id = _property AND w.retired_at IS NULL AND w.status <> 'archived'
    ORDER BY w.created_at LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('reason','confirmed_map','source','work_item','item_id',r.id,'item_title',r.title,'map_id',r.map_id); END IF;
  RETURN NULL;
END $$;

-- The live plan card on an automated home that a new owner item would repeat, or no row.
CREATE FUNCTION private.ao_live_card_match(_property uuid, _task uuid, _template uuid, _title text)
RETURNS TABLE (plan_card_id uuid, code text, title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pc.id, c.code, c.title FROM public.ao_home_plan_cards pc
  JOIN public.ao_library_cards c ON c.id = pc.card_id
  JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
  WHERE pc.property_id = _property AND pc.join_outcome IN ('locked','open') AND pc.expired_at IS NULL
    AND ((_task IS NOT NULL AND pc.linked_task_id = _task)
      OR EXISTS (SELECT 1 FROM public.ao_card_item_map m WHERE m.card_code = c.code AND m.status = 'confirmed'
           AND ((m.match_kind = 'template_id' AND _template IS NOT NULL AND m.match_value = _template::text)
             OR (m.match_kind = 'title_pattern' AND coalesce(_title,'') ILIKE m.match_value))))
  ORDER BY (pc.linked_task_id IS NOT DISTINCT FROM _task) DESC, c.code LIMIT 1
$$;

-- 3. Guard: every path that creates an owner item (Task send, Operations send, releases) ------------
CREATE FUNCTION private.ao_guard_owner_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prop uuid; task uuid; tmpl uuid; ttl text; actor uuid; hit record; conf uuid;
BEGIN
  IF coalesce(current_setting('app.ao_engine', true), '') = 'on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'owner_reviews' THEN
    prop := coalesce(NEW.property_id, (SELECT p.property_id FROM public.owner_programs p WHERE p.id = NEW.program_id));
    task := NEW.onboarding_task_id; tmpl := NEW.template_id; ttl := NEW.title; actor := coalesce(auth.uid(), NEW.created_by);
  ELSE
    IF NEW.kind IS DISTINCT FROM 'opportunity' OR NEW.source_table = 'owner_reviews' THEN RETURN NEW; END IF;
    prop := NEW.property_id; task := coalesce(NEW.source_task_id, NEW.linked_task_id);
    tmpl := NEW.library_template_id; ttl := NEW.title; actor := auth.uid();
  END IF;
  IF prop IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO hit FROM private.ao_live_card_match(prop, task, tmpl, ttl);
  IF NOT FOUND THEN RETURN NEW; END IF;
  UPDATE public.ao_one_off_confirmations SET used_at = now()
  WHERE id = (SELECT k.id FROM public.ao_one_off_confirmations k
    WHERE k.property_id = prop AND k.used_at IS NULL AND k.created_at > now() - interval '30 minutes'
      AND (actor IS NULL OR k.confirmed_by = actor)
      AND ((task IS NOT NULL AND k.task_id = task) OR (k.title_key <> '' AND k.title_key = private.ao_title_key(ttl)))
    ORDER BY k.created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING id INTO conf;
  IF conf IS NOT NULL THEN
    INSERT INTO public.ao_dedupe_events(subject, subject_id, action, detail, actor)
    VALUES ('one_off', conf, 'used', jsonb_build_object('plan_card_id', hit.plan_card_id, 'card_code', hit.code, 'title', ttl), actor);
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'This home already has "%" on its Active Owner plan. Open that card on the home page instead, or confirm that you are sending a different one-off.', hit.title
    USING ERRCODE = 'P0001', HINT = 'ao_card_exists:' || hit.plan_card_id::text;
END $$;
CREATE TRIGGER ao_guard_owner_item BEFORE INSERT ON public.owner_reviews FOR EACH ROW EXECUTE FUNCTION private.ao_guard_owner_item();
CREATE TRIGGER ao_guard_owner_item BEFORE INSERT ON public.work_items FOR EACH ROW EXECUTE FUNCTION private.ao_guard_owner_item();

CREATE FUNCTION public.ao_confirm_one_off(_property uuid, _task uuid, _title text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid;
BEGIN
  IF NOT public.is_internal_staff(uid) THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF _property IS NULL THEN RAISE EXCEPTION 'Choose a home'; END IF;
  INSERT INTO public.ao_one_off_confirmations(property_id, task_id, title_key, confirmed_by)
  VALUES (_property, _task, private.ao_title_key(_title), uid) RETURNING id INTO rid;
  INSERT INTO public.ao_dedupe_events(subject, subject_id, action, detail, actor)
  VALUES ('one_off', rid, 'confirmed', jsonb_build_object('property_id', _property, 'task_id', _task, 'title', _title), uid);
  RETURN rid;
END $$;

-- 4. Staff-confirmed map and step-link suggestions ---------------------------------------------------
CREATE FUNCTION public.ao_card_item_map_decide(_id uuid, _status text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); old_status text;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can confirm these matches' USING ERRCODE = '42501'; END IF;
  IF _status NOT IN ('suggested','confirmed','rejected') THEN RAISE EXCEPTION 'Unknown choice'; END IF;
  SELECT status INTO old_status FROM public.ao_card_item_map WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  UPDATE public.ao_card_item_map SET status = _status,
    decided_by = CASE WHEN _status = 'suggested' THEN NULL ELSE uid END,
    decided_at = CASE WHEN _status = 'suggested' THEN NULL ELSE now() END
  WHERE id = _id;
  INSERT INTO public.ao_dedupe_events(subject, subject_id, action, detail, actor)
  VALUES ('item_map', _id, _status, jsonb_build_object('from', old_status), uid);
  RETURN _status;
END $$;

CREATE FUNCTION public.ao_step_link_decide(_id uuid, _accept boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s public.ao_card_step_link_suggestions; c public.ao_library_cards; changed boolean := false;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can decide step links' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.ao_card_step_link_suggestions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion not found'; END IF;
  IF s.status <> 'suggested' THEN RAISE EXCEPTION 'This suggestion was already decided'; END IF;
  IF _accept THEN
    SELECT * INTO c FROM public.ao_library_cards WHERE code = s.card_code FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Card not found'; END IF;
    IF s.suggestion_kind = 'link' THEN
      UPDATE public.ao_library_cards SET
        linked_template_task_ids = ARRAY(SELECT DISTINCT x FROM unnest(c.linked_template_task_ids || s.template_task_ids) x ORDER BY x),
        version = version + 1, updated_by = uid, updated_at = now()
      WHERE id = c.id RETURNING * INTO c;
      changed := true;
    ELSIF s.proposed_lock = 'open_day_one' AND c.lock_rule <> 'none' THEN
      UPDATE public.ao_library_cards SET lock_rule = 'none', version = version + 1, updated_by = uid, updated_at = now()
      WHERE id = c.id RETURNING * INTO c;
      changed := true;
    END IF; -- 'unlock_now_only' keeps the card as it is: locked with no link opens only with Unlock now
    IF changed THEN
      INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (c.id, c.version, to_jsonb(c), uid);
    END IF;
  END IF;
  UPDATE public.ao_card_step_link_suggestions SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END,
    decided_by = uid, decided_at = now() WHERE id = _id;
  INSERT INTO public.ao_dedupe_events(subject, subject_id, action, detail, actor)
  VALUES ('step_link', _id, CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END, jsonb_build_object('card_code', s.card_code, 'card_changed', changed), uid);
  RETURN CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END;
END $$;

-- 5. After-handoff plan: send or covered by a card ----------------------------------------------------
CREATE FUNCTION public.after_handoff_plan_set_coverage(_id uuid, _coverage text, _card_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_row public.after_handoff_plan_items; new_row public.after_handoff_plan_items;
BEGIN
  IF NOT private.after_handoff_plan_editor() THEN RAISE EXCEPTION 'Only an Admin or the Director of Operations can change the after-handoff plan.'; END IF;
  IF _coverage NOT IN ('send','covered_by_card') THEN RAISE EXCEPTION 'Choose Send or Covered by a card.'; END IF;
  IF _coverage = 'covered_by_card' AND NOT EXISTS (SELECT 1 FROM public.ao_library_cards WHERE code = _card_code) THEN
    RAISE EXCEPTION 'Choose a card from the card library.';
  END IF;
  SELECT * INTO old_row FROM public.after_handoff_plan_items WHERE id = _id FOR UPDATE;
  IF old_row.id IS NULL THEN RAISE EXCEPTION 'Plan item not found.'; END IF;
  UPDATE public.after_handoff_plan_items SET coverage = _coverage,
    covered_card_code = CASE WHEN _coverage = 'covered_by_card' THEN _card_code END,
    updated_by = auth.uid(), updated_at = now()
  WHERE id = _id RETURNING * INTO new_row;
  INSERT INTO public.after_handoff_plan_events(plan_item_id, actor_id, action, old_value, new_value)
  VALUES (_id, auth.uid(), 'coverage_changed', to_jsonb(old_row), to_jsonb(new_row));
  RETURN true;
END $$;

-- 6. Replaced: switch-on preview (same signature and ACL). Adds automatic covered marking and the covered list.
CREATE OR REPLACE FUNCTION public.ao_preview_home_automation(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); prog_id uuid; stage text; c public.ao_library_cards;
  outcome text; task_done boolean; counts jsonb := '{}'::jsonb; already int := 0;
  task_id uuid; cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; covered jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can preview the automated plan' USING ERRCODE = '42501'; END IF;
  SELECT id INTO prog_id FROM public.owner_programs WHERE property_id = _property AND status = 'active' AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF prog_id IS NULL THEN RETURN jsonb_build_object('ready', false, 'reason', 'This home has no active Active Owner program'); END IF;
  stage := private.ao_home_stage(_property);
  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' ORDER BY code LOOP
    IF EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id) THEN
      already := already + 1; CONTINUE;
    END IF;
    task_id := NULL; task_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO task_id, task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason','staff_marked');
    ELSIF task_id IS NOT NULL AND task_id = ANY (claimed) THEN cov := jsonb_build_object('reason','same_task_other_card');
    ELSE cov := private.ao_card_coverage(_property, c.code, task_id); END IF;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    IF outcome = 'already_covered' THEN
      covered := covered || jsonb_build_array(cov || jsonb_build_object('code', c.code, 'title', c.title));
    ELSIF outcome IN ('locked','open') AND task_id IS NOT NULL THEN
      claimed := claimed || task_id;
    END IF;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('ready', true, 'stage', stage, 'outcomes', counts, 'already_on_plan', already, 'covered', covered);
END $function$;

-- 7. Replaced: switch-on (same signature and ACL). Automatic covered marking with the reason recorded;
--    a linked Task that already has an owner item never fails the switch-on.
CREATE OR REPLACE FUNCTION public.ao_set_home_automation(_property uuid, _on boolean, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); prog public.owner_programs; stage text; c public.ao_library_cards;
  outcome text; task_id uuid; task_done boolean; rid uuid; pcid uuid; demo boolean; counts jsonb := '{}'::jsonb;
  cov jsonb; review_task uuid;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can change the automated plan' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.ao_home_plan_settings(property_id, automated, updated_by, updated_at) VALUES (_property, _on, uid, now())
    ON CONFLICT (property_id) DO UPDATE SET automated = EXCLUDED.automated, updated_by = uid, updated_at = now();
  INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by) VALUES (_property, _on, uid);
  IF NOT _on THEN RETURN jsonb_build_object('automated', false); END IF; -- OFF never edits or deletes existing items

  SELECT * INTO prog FROM public.owner_programs WHERE property_id = _property AND status = 'active' AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'This home has no active Active Owner program'; END IF;
  stage := private.ao_home_stage(_property);
  demo := prog.is_demo OR coalesce((SELECT is_demo FROM public.properties WHERE id = _property), false);
  PERFORM set_config('app.ao_engine', 'on', true); -- the plan's own card items pass the duplicate guard

  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' ORDER BY code LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id);
    task_id := NULL; task_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO task_id, task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason','staff_marked');
    ELSE cov := private.ao_card_coverage(_property, c.code, task_id); END IF;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    rid := NULL;
    IF outcome IN ('locked','open') THEN
      -- A withdrawn item can still hold the Task's one owner-item slot; the card item then carries no Task pointer.
      review_task := CASE WHEN task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.owner_reviews o WHERE o.onboarding_task_id = task_id)
                          THEN NULL ELSE task_id END;
      INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
        owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
      VALUES (prog.id, _property, 'onboarding', c.stage_window, c.title,
        CASE WHEN outcome = 'locked' THEN 'Coming soon: waiting on ARHA to ' || coalesce(nullif(c.opens_text,''), 'finish the step before this') ELSE c.why_text END,
        CASE WHEN outcome = 'locked' THEN 'prepared' ELSE 'awaiting_owner' END,
        'onboarding', 'participate', review_task, demo, uid, 'property')
      RETURNING id INTO rid;
    END IF;
    INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, owner_review_id, linked_task_id,
        covered_reason, covered_source, covered_item_id)
      VALUES (_property, prog.id, c.id, c.version, outcome, rid, task_id,
        CASE WHEN outcome = 'already_covered' THEN cov->>'reason' END,
        CASE WHEN outcome = 'already_covered' THEN cov->>'source' END,
        CASE WHEN outcome = 'already_covered' THEN (cov->>'item_id')::uuid END)
      RETURNING id INTO pcid;
    IF outcome = 'open' THEN
      -- open cards start their clock now (same rule as unlock)
      UPDATE public.ao_home_plan_cards SET join_outcome = 'locked' WHERE id = pcid;
      PERFORM private.ao_unlock(pcid, uid);
      UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = pcid;
    END IF;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  PERFORM set_config('app.ao_engine', '', true);
  RETURN jsonb_build_object('automated', true, 'stage', stage, 'outcomes', counts);
END $function$;

-- 8. Replaced: after-handoff scheduling (same signature and ACL). Skips items covered by a live card the home has.
CREATE OR REPLACE FUNCTION private.schedule_after_handoff(_project_id uuid, _property_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _program uuid; _demo boolean; _accept_day date; _n integer;
BEGIN
  SELECT coalesce(is_demo,false) INTO _demo FROM public.properties WHERE id=_property_id;
  IF coalesce(_demo,false) THEN RETURN 0; END IF;
  SELECT op.id INTO _program FROM public.owner_programs op
  WHERE op.status='active' AND NOT op.is_demo AND op.archived_at IS NULL
    AND (op.property_id=_property_id OR EXISTS (SELECT 1 FROM public.owner_program_properties pp
         WHERE pp.program_id=op.id AND pp.property_id=_property_id AND pp.archived_at IS NULL AND NOT pp.is_demo))
  ORDER BY op.created_at DESC LIMIT 1;
  IF _program IS NULL THEN
    INSERT INTO public.after_handoff_schedule_events(property_id,project_id,actor_id,action,note)
    VALUES (_property_id,_project_id,auth.uid(),'no_program','No Active Owner program at handoff; nothing scheduled');
    RETURN 0;
  END IF;
  _accept_day := (now() AT TIME ZONE 'America/Chicago')::date;
  INSERT INTO public.after_handoff_schedule_events(property_id,project_id,actor_id,action,new_value,note)
  SELECT _property_id,_project_id,auth.uid(),'skipped_covered',jsonb_build_object('plan_item_id',p.id,'card_code',p.covered_card_code),'Covered by a card on this home''s plan'
  FROM public.after_handoff_plan_items p WHERE p.active AND p.coverage='covered_by_card'
    AND EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards lc ON lc.id=pc.card_id
                WHERE pc.property_id=_property_id AND lc.code=p.covered_card_code AND pc.join_outcome IN ('locked','open'))
    AND NOT EXISTS (SELECT 1 FROM public.after_handoff_schedule s WHERE s.property_id=_property_id AND s.plan_item_id=p.id);
  WITH ins AS (
    INSERT INTO public.after_handoff_schedule(program_id,property_id,project_id,plan_item_id,title,source_kind,template_id,library_id,send_on,last_changed_by)
    SELECT _program,_property_id,_project_id,p.id,p.title,p.source_kind,p.template_id,p.library_id,_accept_day+p.send_after_days,auth.uid()
    FROM public.after_handoff_plan_items p WHERE p.active
      AND NOT (p.coverage='covered_by_card' AND EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards lc ON lc.id=pc.card_id
               WHERE pc.property_id=_property_id AND lc.code=p.covered_card_code AND pc.join_outcome IN ('locked','open')))
    ORDER BY p.send_after_days, p.sort_order
    ON CONFLICT (property_id, plan_item_id) DO NOTHING
    RETURNING *
  ), ev AS (
    INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,project_id,actor_id,action,new_value,note)
    SELECT ins.id,_property_id,_project_id,auth.uid(),'scheduled',jsonb_build_object('send_on',ins.send_on,'status','scheduled'),'Scheduled at handoff acceptance'
    FROM ins RETURNING 1
  ) SELECT count(*) INTO _n FROM ev;
  RETURN _n;
END $function$;

-- 9. Grants: new functions are never executable by anon or PUBLIC.
REVOKE ALL ON FUNCTION private.ao_title_key(text), private.ao_card_coverage(uuid,text,uuid),
  private.ao_live_card_match(uuid,uuid,uuid,text), private.ao_guard_owner_item() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.ao_title_key(text), private.ao_card_coverage(uuid,text,uuid),
  private.ao_live_card_match(uuid,uuid,uuid,text), private.ao_guard_owner_item() TO service_role;
REVOKE ALL ON FUNCTION public.ao_confirm_one_off(uuid,uuid,text), public.ao_card_item_map_decide(uuid,text),
  public.ao_step_link_decide(uuid,boolean), public.after_handoff_plan_set_coverage(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ao_confirm_one_off(uuid,uuid,text), public.ao_card_item_map_decide(uuid,text),
  public.ao_step_link_decide(uuid,boolean), public.after_handoff_plan_set_coverage(uuid,text,text) TO authenticated, service_role;

-- 10. Suggestions only (status suggested). Nothing counts until Admin or the Onboarding Director confirms.
INSERT INTO public.ao_card_item_map(match_kind, match_value, card_code, note) VALUES
  ('title_pattern','%readiness call%','A57','Owner readiness call items'),
  ('title_pattern','%property management agreement%','A39','Agreement items'),
  ('title_pattern','%management agreement%','A39','Agreement items'),
  ('title_pattern','%closing documents%','A40','Closing documents items'),
  ('title_pattern','%make ready%','A27','Make-ready estimate items'),
  ('title_pattern','%make-ready%','A27','Make-ready estimate items'),
  ('template_id','a6b6d175-d9b4-4d03-872d-97fa1dd55f95','A27','Review and approve the make-ready scope'),
  ('title_pattern','%mood board%','A25','Mood board items'),
  ('title_pattern','%floor plan%','A26','Floor plan items'),
  ('template_id','94212067-30f6-4888-bf05-322153e67182','A26','Finalize furniture and layout'),
  ('title_pattern','%onboarding invoice%','A28','Furnishing invoice items'),
  ('title_pattern','%final cost%','A41','Final cost items'),
  ('template_id','0c619722-4d72-4837-8ac4-0a6d46ea303d','A15','Approve repairs and expenses'),
  ('title_pattern','%repair estimate%','A27','Repair estimate items'),
  ('title_pattern','%handoff meeting%','A31','Handoff meeting items'),
  ('template_id','deb750e0-8821-4ab2-ad51-b88a59b5f507','A31','Review handoff materials'),
  ('template_id','5cff8734-d887-4498-86b1-79e8a650242d','P07','Approve the listing description'),
  ('title_pattern','%listing description%','P07','Listing description items'),
  ('template_id','f02b601c-eddc-4e31-a7ae-dc3147d39f54','P08','Select listing photos'),
  ('template_id','c5f88d78-cf74-43f0-b843-b585f30385dd','A03','Review the new house assessment'),
  ('title_pattern','%house assessment%','A03','House assessment items'),
  ('template_id','45c497b6-ea7b-497e-ad0d-142cf797dcce','A33','Review bookings'),
  ('template_id','854493fb-f7aa-4c02-9f3f-48fd9ac20ee1','A24','Discuss furnishing preferences'),
  ('title_pattern','%furnishing preferences%','A24','Furnishing preference items');
INSERT INTO public.ao_card_step_link_suggestions(card_code, suggestion_kind, template_task_ids, proposed_lock, confidence, note) VALUES
  ('A03','link',ARRAY['4708b6a4-b6bf-47e7-918f-110607d82a9c','ae817018-1ddb-4cb0-9ff8-9b0102b6db53']::uuid[],NULL,'high','Card opens when ARHA uploads the assessment; this step produces it.'),
  ('A25','link',ARRAY['465ed7be-2ae9-497f-857f-447553df16c5','60d33519-b3dd-4c5a-ac27-a8e6c1febb5b']::uuid[],NULL,'high','Step shares the mood board with the owner.'),
  ('A26','link',ARRAY['465ed7be-2ae9-497f-857f-447553df16c5']::uuid[],NULL,'high','Same step shares the floor plan. Full Plan has no floor plan step.'),
  ('A27','link',ARRAY['3621f91b-80aa-4e90-b92f-f978c7fb6743','9ca4d305-dc1a-4bc7-8576-538b524b3a04']::uuid[],NULL,'high','Step sends the estimate the card asks the owner to authorize. Full Plan match is medium.'),
  ('A28','link',ARRAY['c8e7a719-a1b6-4018-83cc-eb95a9f909c2','3bf15c5a-dfcb-4754-a846-6785a9320da9']::uuid[],NULL,'high','Step issues the furnishing invoice. Full Plan match is medium.'),
  ('A31','link',ARRAY['ef76b3e0-02af-43f2-8d26-8e5d1d66bc07','dc75638c-9cf0-4b99-91f4-4bd7baad6e33']::uuid[],NULL,'high','Card opens once the handoff meeting is scheduled.'),
  ('A39','link',ARRAY['263f7c5c-5df2-4d0d-943d-e2603a0f8139','51537bcc-19df-44b9-8703-0089b3e35d92']::uuid[],NULL,'high','Step sends the agreement.'),
  ('A41','link',ARRAY['98efdfb5-e68c-4b84-a059-e67aca03df17','f49f883a-0445-4d62-8cab-ad5e1aef72f2']::uuid[],NULL,'high','Step issues the cost summary. Full Plan match is medium.'),
  ('A57','link',ARRAY['ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49']::uuid[],NULL,'high','Card opens after the planning call is held. Full Plan has no matching step.'),
  ('N02','link',ARRAY['9c26d406-c71f-4802-b14f-36dfe5164839']::uuid[],NULL,'low','Walkthrough photos may include appliances and systems; confirm before accepting.'),
  ('P03','link',ARRAY['7c6b189e-e4c7-4ef4-b26a-5c5e2ae623aa']::uuid[],NULL,'medium','Design inputs include bed sizes and occupancy.'),
  ('P04','link',ARRAY['7c6b189e-e4c7-4ef4-b26a-5c5e2ae623aa']::uuid[],NULL,'medium','Design inputs include occupancy and layout.'),
  ('P12','link',ARRAY['423b20b6-a3c4-4a4a-a3d8-7090886f5ac9']::uuid[],NULL,'high','Card final step opens with the live listing link.'),
  ('P13','link',ARRAY['5b46375b-3795-44a9-aef1-13f28d73541a','3d78ec10-01f6-43f2-97c8-87ac0dc2058f']::uuid[],NULL,'medium','Approved photos and listing content are ready after this step.'),
  ('P14','link',ARRAY['5b46375b-3795-44a9-aef1-13f28d73541a','3d78ec10-01f6-43f2-97c8-87ac0dc2058f']::uuid[],NULL,'medium','Approved photos and listing content are ready after this step.'),
  ('P15','link',ARRAY['423b20b6-a3c4-4a4a-a3d8-7090886f5ac9']::uuid[],NULL,'high','Card final step opens with the live link.'),
  ('P19','link',ARRAY['cbb23216-ee09-4301-b0b0-4392a960a145']::uuid[],NULL,'medium','Guest instructions carry the approved facts and rules.'),
  ('P20','link',ARRAY['d3bc3652-f977-4e97-bab0-d202c4aafd57','473c402d-63c8-4140-879e-0e97b72d0ca1']::uuid[],NULL,'medium','Approved photo assets are ready after this step.'),
  ('A14','lock',ARRAY[]::uuid[],'unlock_now_only','high','Operations reports have no onboarding step. Keep it locked and use Unlock now when it applies.'),
  ('A15','lock',ARRAY[]::uuid[],'unlock_now_only','high','Operations repair estimates have no onboarding step. Keep it locked and use Unlock now when it applies.'),
  ('A30','lock',ARRAY[]::uuid[],'unlock_now_only','high','Substitutions come up case by case. Keep it locked and use Unlock now when it applies.'),
  ('A33','lock',ARRAY[]::uuid[],'unlock_now_only','high','First booking has no onboarding step. Keep it locked and use Unlock now when it applies.'),
  ('A35','lock',ARRAY[]::uuid[],'unlock_now_only','high','Statements have no onboarding step. Keep it locked and use Unlock now when it applies.'),
  ('A51','lock',ARRAY[]::uuid[],'unlock_now_only','high','Appliance issues come up case by case. Keep it locked and use Unlock now when it applies.'),
  ('A56','lock',ARRAY[]::uuid[],'unlock_now_only','high','Documentation sessions are scheduled case by case. Keep it locked and use Unlock now when it applies.'),
  ('N10','lock',ARRAY[]::uuid[],'unlock_now_only','high','First month feedback happens after handoff. Keep it locked and use Unlock now when it applies.');
