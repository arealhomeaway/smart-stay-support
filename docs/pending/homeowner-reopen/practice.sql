-- Practice for homeowner-reopen: apply.sql unchanged, then the cases below, in one transaction that
-- always rolls back (the last statement raises 'PRACTICE ROLLED BACK').
-- homeowner-reopen: a homeowner can reopen what she finished or submitted, add more and update it.
-- Nothing she sent is lost: hours keep the original entry (amends_entry_id), card answers keep
-- before/after in ao_contribution_changes, Opportunity and owner item messages are append only.
-- Every change posts one line in the home's owner chat and one row in homeowner_updates, which the
-- team reads as "Homeowner updated [item] on [date]". Homeowners change only their own work.

-- 1. The team's record of homeowner updates (append only).
CREATE TABLE IF NOT EXISTS public.homeowner_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id),
  property_id uuid REFERENCES public.properties(id),
  kind text NOT NULL CHECK (kind IN ('hours', 'card', 'opportunity', 'owner_item')),
  item_id uuid NOT NULL,
  item_title text NOT NULL CHECK (length(item_title) BETWEEN 1 AND 300),
  task_id uuid,
  actor_id uuid NOT NULL,
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 600),
  chat_message_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homeowner_updates_property_idx ON public.homeowner_updates (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS homeowner_updates_task_idx ON public.homeowner_updates (task_id, created_at DESC) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS homeowner_updates_program_idx ON public.homeowner_updates (program_id, created_at DESC);

GRANT SELECT ON public.homeowner_updates TO authenticated;
GRANT ALL ON public.homeowner_updates TO service_role;
ALTER TABLE public.homeowner_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read homeowner updates" ON public.homeowner_updates
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Homeowners read their own updates" ON public.homeowner_updates
  FOR SELECT TO authenticated USING (actor_id = auth.uid());
CREATE POLICY "Synthetic accounts: demo records only" ON public.homeowner_updates
  AS RESTRICTIVE FOR ALL TO authenticated USING ((NOT (SELECT private.is_synthetic_account())) OR is_demo);

CREATE OR REPLACE FUNCTION private.homeowner_updates_append_only()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Homeowner updates are kept as history and cannot be changed.';
END $function$;
CREATE TRIGGER homeowner_updates_append_only BEFORE UPDATE OR DELETE ON public.homeowner_updates
  FOR EACH ROW EXECUTE FUNCTION private.homeowner_updates_append_only();

-- 2. One helper: the owner chat line (optional) and the team record.
CREATE OR REPLACE FUNCTION private.record_homeowner_update(_program uuid, _property uuid, _kind text, _item uuid,
  _title text, _task uuid, _summary text, _chat_body text, _chat_id uuid DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; home uuid := _property; mid uuid := _chat_id; new_id uuid;
BEGIN
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program;
  IF NOT FOUND THEN RAISE EXCEPTION 'This program is not available.'; END IF;
  home := coalesce(home, prog.property_id);
  IF mid IS NULL AND _chat_body IS NOT NULL AND home IS NOT NULL THEN
    mid := public.post_home_chat_message(home, 'owner', left(_chat_body, 1000), '[]'::jsonb, '{}'::uuid[]);
  END IF;
  INSERT INTO public.homeowner_updates(program_id, property_id, kind, item_id, item_title, task_id, actor_id, summary, chat_message_id, is_demo)
  VALUES (prog.id, home, _kind, _item, left(coalesce(nullif(btrim(_title), ''), 'An item'), 300), _task, auth.uid(),
          left(_summary, 600), mid, coalesce(prog.is_demo, false))
  RETURNING id INTO new_id;
  RETURN new_id;
END $function$;
REVOKE ALL ON FUNCTION private.record_homeowner_update(uuid, uuid, text, uuid, text, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- 3. Hours: Edit (description, date, time, files) or Add more (a note or a file) on her own entry.
-- A new entry amends the original; the original stays as history. It waits for review again.
CREATE OR REPLACE FUNCTION public.owner_update_time_entry(_entry_id uuid, _change jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); original public.owner_time_entries; program public.owner_programs; review public.owner_reviews;
  scope uuid; new_id uuid; mode text; act text; day date; mins integer; note text; paths jsonb; old_paths jsonb; added jsonb; p text;
  comments text; reason text; changed text[] := '{}'; label text; home uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to change your hours.'; END IF;
  IF _change IS NULL OR jsonb_typeof(_change) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Your change could not be read. Try again.'; END IF;
  mode := coalesce(_change->>'mode', 'edit');
  IF mode NOT IN ('edit', 'add') THEN RAISE EXCEPTION 'Your change could not be read. Try again.'; END IF;
  SELECT program_id INTO scope FROM public.owner_time_entries WHERE id = _entry_id AND owner_user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'That entry is not available to you.'; END IF;
  program := private.lock_owner_time_program(scope, uid, false, false);
  IF NOT pg_try_advisory_xact_lock(hashtextextended('owner-time-correction:' || _entry_id::text, 0)) THEN
    RAISE EXCEPTION 'This entry is being changed. Refresh and try again.';
  END IF;
  SELECT * INTO original FROM public.owner_time_entries WHERE id = _entry_id FOR UPDATE NOWAIT;
  IF NOT FOUND OR original.program_id IS DISTINCT FROM program.id OR original.owner_user_id IS DISTINCT FROM uid
     OR original.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The entry changed. Refresh and try again.'; END IF;
  IF EXISTS (SELECT 1 FROM public.owner_time_entries WHERE amends_entry_id = original.id) THEN
    RAISE EXCEPTION 'This entry was already updated. Refresh to see the latest version.';
  END IF;

  old_paths := CASE WHEN jsonb_typeof(original.attachment_paths) = 'array' AND jsonb_array_length(original.attachment_paths) > 0 THEN original.attachment_paths
                    WHEN original.attachment_path IS NOT NULL THEN jsonb_build_array(original.attachment_path)
                    ELSE '[]'::jsonb END;
  -- Files are only added: every file she sent before stays with the entry.
  added := coalesce(_change->'addPaths', '[]'::jsonb);
  IF jsonb_typeof(added) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'One of the files could not be recorded. Try again.'; END IF;
  FOR p IN SELECT jsonb_array_elements_text(added) LOOP
    IF p IS NULL OR length(p) NOT BETWEEN 1 AND 400 OR old_paths ? p
       OR left(p, length('owner_participation/' || program.id::text || '/')) <> 'owner_participation/' || program.id::text || '/' THEN
      RAISE EXCEPTION 'One of the files could not be recorded. Try again.';
    END IF;
  END LOOP;
  paths := old_paths || added;
  IF jsonb_array_length(paths) > 10 THEN RAISE EXCEPTION 'Attach at most ten files to one entry.'; END IF;

  IF mode = 'edit' THEN
    act := btrim(coalesce(_change->>'activity', original.activity));
    day := coalesce(nullif(_change->>'entryDate', '')::date, original.entry_date);
    mins := coalesce(nullif(_change->>'minutes', '')::integer, original.minutes);
  ELSE
    act := original.activity; day := original.entry_date; mins := original.minutes;
  END IF;
  note := nullif(btrim(coalesce(_change->>'note', '')), '');
  IF mins IS NULL OR mins NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Enter the time you spent, up to 24 hours.'; END IF;
  IF length(coalesce(act, '')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Describe what you did in 3 to 500 characters.'; END IF;
  IF day IS NULL OR NOT isfinite(day) OR day > private.business_today() THEN RAISE EXCEPTION 'Choose a date no later than today.'; END IF;
  IF note IS NOT NULL AND length(note) > 1000 THEN RAISE EXCEPTION 'Keep your note under 1,000 characters.'; END IF;
  IF original.review_id IS NOT NULL THEN
    SELECT * INTO review FROM public.owner_reviews WHERE id = original.review_id;
    IF FOUND AND review.available_from IS NOT NULL AND day < review.available_from::date THEN
      RAISE EXCEPTION 'Choose a date on or after the day this was sent to you.';
    END IF;
  END IF;

  IF mins IS DISTINCT FROM original.minutes THEN changed := array_append(changed, 'time'); END IF;
  IF day IS DISTINCT FROM original.entry_date THEN changed := array_append(changed, 'date'); END IF;
  IF act IS DISTINCT FROM original.activity THEN changed := array_append(changed, 'description'); END IF;
  IF note IS NOT NULL THEN changed := array_append(changed, 'note'); END IF;
  IF paths IS DISTINCT FROM old_paths THEN changed := array_append(changed, 'files'); END IF;
  IF cardinality(changed) = 0 THEN
    RAISE EXCEPTION '%', CASE WHEN mode = 'add' THEN 'Add a note or a file first.' ELSE 'Nothing changed.' END;
  END IF;

  comments := original.comments;
  IF note IS NOT NULL THEN
    comments := concat_ws(E'\n\n', nullif(comments, ''), 'Added ' || to_char(private.business_today(), 'Mon FMDD') || ': ' || note);
  END IF;
  IF length(coalesce(comments, '')) > 4000 THEN RAISE EXCEPTION 'This entry has too many notes. Start a new entry instead.'; END IF;
  reason := CASE WHEN mode = 'add' THEN 'Homeowner added more' ELSE 'Homeowner edited the entry' END;

  INSERT INTO public.owner_time_entries(program_id, owner_user_id, phase, entry_date, minutes, activity, activity_category, output,
      decision_outcome, materials_reviewed, attachment_path, attachment_paths, comments, review_id, ticket_id, amends_entry_id,
      correction_reason, review_status, attested, is_demo)
  VALUES (original.program_id, original.owner_user_id, original.phase, day, mins, act, original.activity_category, original.output,
      original.decision_outcome, original.materials_reviewed, paths->>0, paths, comments, original.review_id, original.ticket_id, original.id,
      reason, 'submitted', true, original.is_demo)
  RETURNING id INTO new_id;
  INSERT INTO public.owner_time_entry_properties(entry_id, property_id)
    SELECT new_id, property_id FROM public.owner_time_entry_properties WHERE entry_id = original.id ORDER BY property_id;
  SELECT property_id INTO home FROM public.owner_time_entry_properties WHERE entry_id = new_id ORDER BY property_id LIMIT 1;
  UPDATE public.owner_programs SET last_owner_activity_at = now() WHERE id = program.id;
  INSERT INTO public.owner_program_events(program_id, entry_id, review_id, kind, summary, actor_id, previous_value, new_value, reason, detail)
  VALUES (program.id, new_id, original.review_id, 'time_entry', reason || ': ' || act, uid, original.minutes::text, mins::text, reason,
    jsonb_build_object('correctionOf', original.id, 'homeownerUpdate', true, 'changed', to_jsonb(changed),
      'wasReviewed', original.reviewed_at IS NOT NULL, 'attachmentCount', jsonb_array_length(paths),
      'propertyIds', coalesce((SELECT jsonb_agg(property_id ORDER BY property_id) FROM public.owner_time_entry_properties WHERE entry_id = new_id), '[]'::jsonb)));
  label := to_char(day, 'Mon FMDD');
  PERFORM private.record_homeowner_update(program.id, home, 'hours', new_id, 'Hours on ' || label, NULL,
    reason || ' for ' || label || ': ' || left(act, 200),
    CASE WHEN mode = 'add' THEN 'I added more to my hours for ' ELSE 'I updated my hours for ' END || label || ': ' || left(act, 200) || '.');
  RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or entry is being updated. Refresh and try again.';
END $function$;
REVOKE ALL ON FUNCTION public.owner_update_time_entry(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_update_time_entry(uuid, jsonb) TO authenticated;

-- 4. Finished cards: Edit my answer and Add a file also work when nothing was saved with the card.
CREATE OR REPLACE FUNCTION public.ao_edit_card_answer(_plan_card uuid, _values jsonb, _files jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); pc public.ao_home_plan_cards; c public.ao_library_cards; con public.ao_contributions;
  f jsonb; new_files jsonb := coalesce(_files, '[]'::jsonb); vals jsonb := coalesce(_values, '{}'::jsonb);
  change_id uuid; mid uuid; sib public.ao_home_plan_cards;
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR uid IS NULL OR NOT private.owner_current_property_for_actor(uid, pc.property_id, pc.program_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF pc.owner_completed_at IS NULL THEN RAISE EXCEPTION 'Send your answer first.'; END IF;
  IF jsonb_typeof(vals) <> 'object' THEN RAISE EXCEPTION 'Your answer could not be read.'; END IF;
  IF jsonb_typeof(new_files) <> 'array' OR jsonb_array_length(new_files) > 20 THEN RAISE EXCEPTION 'Attach up to 20 files.'; END IF;
  SELECT * INTO c FROM public.ao_library_cards WHERE id = pc.card_id;
  SELECT * INTO con FROM public.ao_contributions WHERE plan_card_id = pc.id ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    -- Finished with nothing saved: her first answer starts the record (an empty before in history).
    IF vals = '{}'::jsonb AND jsonb_array_length(new_files) = 0 THEN RAISE EXCEPTION 'Write your answer or add a file first.'; END IF;
    INSERT INTO public.ao_contributions(plan_card_id, property_id, program_id, card_id, submitted_by, field_values, files)
      VALUES (pc.id, pc.property_id, pc.program_id, pc.card_id, uid, '{}'::jsonb, '[]'::jsonb)
      RETURNING * INTO con;
  END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(new_files) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = (f ->> 'document_id')::uuid AND d.deleted_at IS NULL
                     AND (d.property_id = pc.property_id OR (d.entity_type = 'property' AND d.entity_id = pc.property_id))
                     AND (d.uploaded_by = uid OR con.files @> jsonb_build_array(jsonb_build_object('document_id', f ->> 'document_id')))) THEN
      RAISE EXCEPTION 'A file is not one of your files on this home.';
    END IF;
  END LOOP;
  new_files := coalesce((SELECT jsonb_agg(jsonb_build_object('document_id', x ->> 'document_id', 'name', left(coalesce(x ->> 'name', ''), 300)))
                       FROM jsonb_array_elements(new_files) x), '[]'::jsonb);
  IF con.field_values = vals AND con.files = new_files THEN RAISE EXCEPTION 'Nothing changed.'; END IF;
  mid := public.post_home_chat_message(pc.property_id, 'owner', 'I updated my answer on ' || c.title || '.', '[]'::jsonb, '{}'::uuid[]);
  INSERT INTO public.ao_contribution_changes(plan_card_id, contribution_id, property_id, program_id, changed_by,
      before_values, after_values, before_files, after_files, chat_message_id)
    VALUES (pc.id, con.id, pc.property_id, pc.program_id, uid, con.field_values, vals, con.files, new_files, mid)
    RETURNING id INTO change_id;
  UPDATE public.ao_contributions SET field_values = vals, files = new_files WHERE id = con.id;
  PERFORM private.record_homeowner_update(pc.program_id, pc.property_id, 'card', pc.id, c.title, pc.linked_task_id,
    'Homeowner updated the answer on ' || c.title, NULL, mid);
  -- A market card answered once for every home keeps one answer: its other homes' copies follow.
  IF c.once_per_owner THEN
    FOR sib IN SELECT * FROM public.ao_home_plan_cards s
                WHERE s.program_id = pc.program_id AND s.card_id = pc.card_id AND s.id <> pc.id AND s.owner_completed_at IS NOT NULL LOOP
      CONTINUE WHEN NOT private.owner_current_property_for_actor(uid, sib.property_id, sib.program_id);
      INSERT INTO public.ao_contribution_changes(plan_card_id, contribution_id, property_id, program_id, changed_by,
          before_values, after_values, before_files, after_files, chat_message_id)
        SELECT sib.id, x.id, sib.property_id, sib.program_id, uid, x.field_values, vals, x.files, new_files, mid
          FROM public.ao_contributions x WHERE x.plan_card_id = sib.id ORDER BY x.submitted_at DESC LIMIT 1;
      UPDATE public.ao_contributions SET field_values = vals, files = new_files
       WHERE id = (SELECT x.id FROM public.ao_contributions x WHERE x.plan_card_id = sib.id ORDER BY x.submitted_at DESC LIMIT 1);
    END LOOP;
  END IF;
  RETURN change_id;
END $function$;

-- 5. Finished Opportunities: she adds more. The Opportunity opens again for her and the team;
-- its internal Task is never changed.
CREATE OR REPLACE FUNCTION public.owner_add_to_opportunity(_id uuid, _body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); w public.work_items; _name text; _mid uuid; reopened boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to add more.'; END IF;
  IF coalesce(btrim(_body), '') = '' THEN RAISE EXCEPTION 'Type what you want to add first.'; END IF;
  IF length(_body) > 5000 THEN RAISE EXCEPTION 'Please keep your message under 5,000 characters.'; END IF;
  SELECT * INTO w FROM public.work_items WHERE id = _id AND kind = 'opportunity' AND status NOT IN ('draft', 'archived') FOR UPDATE;
  IF NOT FOUND OR w.program_id IS NULL OR w.retired_at IS NOT NULL OR NOT public.owner_owns_program(w.program_id)
     OR public.is_onboarding_staff(uid) OR public.is_staff(uid) THEN
    RAISE EXCEPTION 'This Opportunity is not available to you.';
  END IF;
  SELECT coalesce(nullif(btrim(full_name), ''), 'The homeowner') INTO _name FROM public.profiles WHERE id = uid;
  IF w.status IN ('complete', 'completed') THEN
    UPDATE public.work_items SET status = 'open', completed_at = NULL WHERE id = w.id;
    INSERT INTO public.owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
    VALUES (w.id, w.property_id, w.program_id, w.source_task_id, uid, 'system', coalesce(_name, 'The homeowner'), 'reopened',
            'Reopened by the homeowner to add more', coalesce(w.is_demo, false));
    reopened := true;
  END IF;
  INSERT INTO public.owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, uid, 'homeowner', coalesce(_name, 'The homeowner'), btrim(_body), coalesce(w.is_demo, false))
  RETURNING id INTO _mid;
  UPDATE public.work_items SET responded_at = now(), viewed_at = coalesce(viewed_at, now()) WHERE id = w.id;
  PERFORM private.notify_opportunity_staff(w.id, CASE WHEN reopened THEN 'reopened an Opportunity to add more' ELSE 'replied' END);
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (uid, 'owner_request_reopened_by_homeowner', 'work_item', w.id, w.title,
          jsonb_build_object('reopened', reopened, 'task_id', w.source_task_id, 'task_changed', false));
  PERFORM private.record_homeowner_update(w.program_id, w.property_id, 'opportunity', w.id, w.title,
    coalesce(w.source_task_id, w.linked_task_id), 'Homeowner added more to ' || w.title,
    'I added more to ' || w.title || '.');
  RETURN _mid;
END $function$;
REVOKE ALL ON FUNCTION public.owner_add_to_opportunity(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_add_to_opportunity(uuid, text) TO authenticated;

-- 6. Owner items: she writes again through the existing reply (it already reopens a closed item).
-- When the item was already answered or closed, the team sees "Homeowner updated".
CREATE OR REPLACE FUNCTION public.owner_item_add(_review_id uuid, _body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private'
AS $function$
DECLARE r public.owner_reviews; was_answered boolean; mid uuid;
BEGIN
  SELECT * INTO r FROM public.owner_reviews WHERE id = _review_id AND archived_at IS NULL;
  was_answered := FOUND AND (r.responded_at IS NOT NULL OR r.status IN ('answered', 'closed'));
  mid := public.owner_item_reply(_review_id, _body);
  IF was_answered THEN
    PERFORM private.record_homeowner_update(r.program_id, r.property_id, 'owner_item', r.id, r.title, r.onboarding_task_id,
      'Homeowner added more to ' || r.title, 'I added more to ' || r.title || '.');
  END IF;
  RETURN mid;
END $function$;
REVOKE ALL ON FUNCTION public.owner_item_add(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_item_add(uuid, text) TO authenticated;

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'homeowner_reopen.apply', 'function', 'homeowner reopen and update',
  'Homeowners can reopen what they finished or submitted, add more and update it; originals kept. Undo: docs/pending/homeowner-reopen/apply.undo.sql.',
  jsonb_build_object('ao_edit_card_answer', 'needed a saved answer'),
  jsonb_build_object('adds', jsonb_build_array('homeowner_updates', 'owner_update_time_entry', 'owner_add_to_opportunity', 'owner_item_add'),
                     'ao_edit_card_answer', 'also works with no saved answer'));

-- ===== Practice (DEMO Willow Creek Cottage, demo owner). Raises at the end so nothing is kept. =====
DO $practice$
DECLARE o text := ''; e1 uuid := 'e3b87270-f840-4e01-b350-d5b54c87aca9'; e2 uuid; e3 uuid; e4 uuid; x uuid; n int; t text;
  before_row text; card uuid := '3465c2a6-c437-40c9-ac05-515e136f4fbe'; opp uuid := '626df90d-8c39-4bad-97ba-285d9e97ee4a';
  answered uuid := 'd29aa7fb-1979-42d7-806b-2cfc4cc40b1c'; waiting uuid := 'e64908c8-4b19-4565-8cd4-6afac1512643';
  P uuid := 'e341b2b0-a6cf-40b3-9d1c-ff7584aec196'; OWNER text := 'b1d78033-d2d4-4e05-8b2d-3c1cbcd8a443';
  SH uuid := '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe';
BEGIN
  SELECT md5(to_jsonb(e)::text) INTO before_row FROM public.owner_time_entries e WHERE id = e1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OWNER, 'role', 'authenticated')::text, true);
  e2 := public.owner_update_time_entry(e1, jsonb_build_object('mode','edit','activity','QA Order C, practice edit','entryDate','2026-11-10','minutes',60));
  SELECT format('1 edit submitted: %s min, %s, %s, amends original %s; ', minutes, entry_date, review_status, amends_entry_id = e1) INTO t FROM public.owner_time_entries WHERE id = e2; o := o || t;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.owner_time_entries SET review_status = 'approved', reviewed_at = now(), reviewed_by = '98bd6696-4018-4965-b645-0471c5ae3925' WHERE id = e2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OWNER, 'role', 'authenticated')::text, true);
  e3 := public.owner_update_time_entry(e2, jsonb_build_object('mode','edit','minutes',75));
  SELECT format('2 edit reviewed: %s min, %s, reviewed %s; ', minutes, review_status, coalesce(reviewed_at::text,'no')) INTO t FROM public.owner_time_entries WHERE id = e3; o := o || t;
  e4 := public.owner_update_time_entry(e3, jsonb_build_object('mode','add','note','Practice note: receipt attached','addPaths', jsonb_build_array('owner_participation/' || P || '/practice-receipt.pdf')));
  SELECT format('3 add more: files %s, note kept %s, %s; ', jsonb_array_length(attachment_paths), comments LIKE '%Practice note%', review_status) INTO t FROM public.owner_time_entries WHERE id = e4; o := o || t;
  SELECT format('4 totals: reviewed %s min, waiting %s min, current %s; ',
    coalesce(sum(minutes) FILTER (WHERE reviewed_at IS NOT NULL), 0), coalesce(sum(minutes) FILTER (WHERE reviewed_at IS NULL), 0), count(*))
    INTO t FROM public.owner_time_entries e WHERE program_id = P AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id); o := o || t;
  SELECT format('5 history: %s entries, original unchanged %s; ', count(*), (SELECT md5(to_jsonb(e)::text) FROM public.owner_time_entries e WHERE id = e1) = before_row)
    INTO t FROM public.owner_time_entries WHERE program_id = P; o := o || t;
  BEGIN PERFORM public.owner_update_time_entry(e1, '{"mode":"edit","minutes":30}'::jsonb); o := o || 'FAILED old; ';
  EXCEPTION WHEN OTHERS THEN o := o || '6 old version refused: ' || SQLERRM || '; '; END;
  BEGIN PERFORM public.owner_update_time_entry(e4, jsonb_build_object('mode','add','addPaths', jsonb_build_array('other/elsewhere.pdf'))); o := o || 'FAILED path; ';
  EXCEPTION WHEN OTHERS THEN o := o || '7 outside file refused: ' || SQLERRM || '; '; END;
  BEGIN PERFORM public.owner_update_time_entry(e4, '{"mode":"add"}'::jsonb); o := o || 'FAILED empty; ';
  EXCEPTION WHEN OTHERS THEN o := o || '8 empty add refused: ' || SQLERRM || '; '; END;
  BEGIN PERFORM public.owner_update_time_entry('2a353b74-8a28-492e-95c9-6aa1b9bf1474', '{"mode":"edit","minutes":30}'::jsonb); o := o || 'FAILED other; ';
  EXCEPTION WHEN OTHERS THEN o := o || '9 another homeowner refused: ' || SQLERRM || '; '; END;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('app.ao_engine', 'on', true);
  UPDATE public.ao_home_plan_cards SET owner_completed_at = now() WHERE id = card;
  PERFORM set_config('app.ao_engine', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OWNER, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.ao_edit_card_answer(card, '{}'::jsonb, '[]'::jsonb); o := o || 'FAILED empty card; ';
  EXCEPTION WHEN OTHERS THEN o := o || '10 empty card refused: ' || SQLERRM || '; '; END;
  x := public.ao_edit_card_answer(card, '{"notes":"Practice: our policy covers rentals"}'::jsonb, '[]'::jsonb);
  x := public.ao_edit_card_answer(card, '{"notes":"Practice: updated again"}'::jsonb, '[]'::jsonb);
  SELECT format('11 card with no answer: answers %s, history %s, latest %s; ', (SELECT count(*) FROM public.ao_contributions WHERE plan_card_id = card),
    (SELECT count(*) FROM public.ao_contribution_changes WHERE plan_card_id = card),
    (SELECT field_values->>'notes' FROM public.ao_contributions WHERE plan_card_id = card)) INTO t; o := o || t;
  x := public.owner_add_to_opportunity(opp, 'Practice: one more thing about this');
  SELECT format('12 finished Opportunity: now %s, new messages %s, reopened %s; ', status,
    (SELECT count(*) FROM public.owner_request_messages WHERE work_item_id = opp AND created_at >= now()),
    (SELECT count(*) FROM public.owner_request_messages WHERE work_item_id = opp AND event = 'reopened' AND created_at >= now())) INTO t
    FROM public.work_items WHERE id = opp; o := o || t;
  x := public.owner_item_add(answered, 'Practice: adding to my answer');
  x := public.owner_item_add(waiting, 'Practice: first answer');
  SELECT format('13 owner items: answered recorded %s, waiting recorded %s; ',
    (SELECT count(*) FROM public.homeowner_updates WHERE item_id = answered), (SELECT count(*) FROM public.homeowner_updates WHERE item_id = waiting)) INTO t; o := o || t;
  SELECT format('14 team lines %s, with chat line %s, new chat lines %s; ', count(*), count(chat_message_id),
    (SELECT count(*) FROM public.home_chat_messages m WHERE m.created_at >= now()))
    INTO t FROM public.homeowner_updates WHERE program_id = P; o := o || t;
  BEGIN UPDATE public.homeowner_updates SET summary = 'x'; o := o || 'FAILED change; ';
  EXCEPTION WHEN OTHERS THEN o := o || '15 change refused: ' || SQLERRM || '; '; END;
  BEGIN DELETE FROM public.homeowner_updates; o := o || 'FAILED delete; ';
  EXCEPTION WHEN OTHERS THEN o := o || '16 delete refused: ' || SQLERRM || '; '; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '98bd6696-4018-4965-b645-0471c5ae3925', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.homeowner_updates; o := o || '17 Admin reads ' || n || '; ';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OWNER, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.homeowner_updates; o := o || 'demo owner reads ' || n || '; ';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT owner_user_id FROM public.owner_programs WHERE id = SH), 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.homeowner_updates; o := o || 'another homeowner reads ' || n || '; ';
  EXECUTE 'RESET ROLE';
  SELECT format('18 Shannon: %s entries, %s hers and current; ', count(*),
    count(*) FILTER (WHERE owner_user_id = (SELECT owner_user_id FROM public.owner_programs WHERE id = SH)
      AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id)))
    INTO t FROM public.owner_time_entries e WHERE program_id = SH; o := o || t;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK: %', o;
END $practice$;
