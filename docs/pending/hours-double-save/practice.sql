-- Practice for hours-double-save, in one transaction that always rolls back (the last statement raises
-- 'PRACTICE ROLLED BACK'). First the homeowner-reopen parts this needs (its sections 1 and 2, unchanged),
-- then apply.sql unchanged, the cases, apply.undo.sql unchanged, and a read back.
CREATE TEMP TABLE _out (n serial, line text) ON COMMIT DROP;
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

-- ===== apply.sql (unchanged) =====
-- hours-double-save: homeowner hour saves (log, edit, add more) refuse the same date, minutes and description
-- saved by the same homeowner in the same program in the last 10 minutes, with "Already saved.".
-- Needs homeowner-reopen applied first (owner_update_time_entry). Nothing else in either action changes.

-- 1. The rule.
-- One rule for both saves: the same homeowner, program, date, minutes and description (spacing and
-- capitals ignored) saved in the last 10 minutes. An edit or Add more leaves out the entry being changed
-- and the versions before it; when she adds a note, the repeat must already carry that note.
CREATE OR REPLACE FUNCTION private.owner_time_recent_repeat(_program uuid, _owner uuid, _day date, _minutes integer,
  _activity text, _note text, _chain_of uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH RECURSIVE chain(id) AS (
    SELECT _chain_of WHERE _chain_of IS NOT NULL
    UNION
    SELECT e.amends_entry_id FROM public.owner_time_entries e JOIN chain c ON e.id = c.id WHERE e.amends_entry_id IS NOT NULL
  )
  SELECT EXISTS (
    SELECT 1 FROM public.owner_time_entries d
     WHERE d.program_id = _program AND d.owner_user_id = _owner AND d.entry_date = _day AND d.minutes = _minutes
       AND d.created_at > now() - interval '10 minutes'
       AND lower(regexp_replace(btrim(d.activity), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(coalesce(_activity, '')), '\s+', ' ', 'g'))
       AND (nullif(btrim(coalesce(_note, '')), '') IS NULL OR position(btrim(_note) IN coalesce(d.comments, '')) > 0)
       AND d.id NOT IN (SELECT id FROM chain))
$function$;
REVOKE ALL ON FUNCTION private.owner_time_recent_repeat(uuid, uuid, date, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- 2. Log hours (today's action, one check added before the save).
CREATE OR REPLACE FUNCTION public.log_owner_time_entry(_entry jsonb, _property_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; opportunity public.owner_reviews; enrollment public.owner_program_properties;
 home public.properties; link record; chosen uuid[]; context_ids uuid[]; chosen_property uuid;
 entry_day date; reported_minutes integer; new_id uuid; ticket public.tickets; manual boolean;
 paths jsonb; path_item text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record participation.'; END IF;
 IF _entry IS NULL OR jsonb_typeof(_entry) IS DISTINCT FROM 'object' OR (_entry->'confirmed') IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'Confirm that this entry records the time you personally spent.';
 END IF;
 program:=private.lock_owner_time_program((_entry->>'programId')::uuid,auth.uid(),false,true);
 entry_day:=(_entry->>'entryDate')::date; reported_minutes:=(_entry->>'minutes')::integer;
 manual:=nullif(_entry->>'reviewId','') IS NULL;
 IF entry_day IS NULL OR NOT isfinite(entry_day) OR entry_day>private.business_today() THEN
  RAISE EXCEPTION 'Choose a date no later than today.';
 END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440
  OR length(trim(coalesce(_entry->>'activity',''))) NOT BETWEEN 3 AND 500
  OR coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing')
  OR length(coalesce(_entry->>'activityCategory',''))>80 OR length(coalesce(_entry->>'output',''))>1000
  OR length(coalesce(_entry->>'comments',''))>1000 OR length(coalesce(_entry->>'attachmentPath',''))>400 THEN
   RAISE EXCEPTION 'Enter the actual activity, phase and minutes within the allowed limits.';
 END IF;
 paths:=coalesce(_entry->'attachmentPaths','[]'::jsonb);
 IF jsonb_typeof(paths) IS DISTINCT FROM 'array' OR jsonb_array_length(paths)>10 THEN
  RAISE EXCEPTION 'Attach at most ten files to one entry.';
 END IF;
 FOR path_item IN SELECT jsonb_array_elements_text(paths) LOOP
  IF path_item IS NULL OR length(trim(path_item)) NOT BETWEEN 1 AND 400 THEN
   RAISE EXCEPTION 'One of the attached files could not be recorded. Try again.';
   END IF;
 END LOOP;
 IF jsonb_array_length(paths)>0 AND nullif(_entry->>'attachmentPath','') IS DISTINCT FROM (paths->>0) THEN
  RAISE EXCEPTION 'The attached files could not be recorded. Try again.';
 END IF;
 IF cardinality(coalesce(_property_ids,'{}'::uuid[]))>25 OR array_position(_property_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Choose at most 25 valid properties.';
 END IF;
 SELECT coalesce(array_agg(DISTINCT p ORDER BY p),'{}'::uuid[]) INTO chosen FROM unnest(coalesce(_property_ids,'{}'::uuid[])) p;
 IF manual THEN
   IF nullif(_entry->>'ticketId','') IS NOT NULL THEN
   RAISE EXCEPTION 'A self-recorded activity cannot carry a Ticket link.';
  END IF;
  context_ids:=chosen;
 ELSE
  SELECT * INTO opportunity FROM public.owner_reviews WHERE id=(_entry->>'reviewId')::uuid AND program_id=program.id FOR SHARE NOWAIT;
  IF NOT FOUND OR opportunity.archived_at IS NOT NULL OR opportunity.is_demo IS DISTINCT FROM program.is_demo
   OR coalesce(opportunity.status,'') NOT IN ('awaiting_owner','answered','returned') OR opportunity.available_from>now() OR opportunity.available_from::date>entry_day
   OR opportunity.phase IS DISTINCT FROM (_entry->>'phase') THEN
   RAISE EXCEPTION 'Choose an available participation opportunity from this program.';
   END IF;
  IF opportunity.task_type NOT IN ('property_specific','multi_property','program_wide') OR opportunity.task_type IS NULL THEN
   RAISE EXCEPTION 'This opportunity needs a valid participation scope.';
  END IF;
  IF opportunity.task_type='property_specific' THEN
   IF opportunity.property_id IS NULL THEN RAISE EXCEPTION 'This opportunity needs its canonical Property.'; END IF;
   IF cardinality(chosen)=0 THEN chosen:=ARRAY[opportunity.property_id]; END IF;
   IF chosen IS DISTINCT FROM ARRAY[opportunity.property_id] THEN RAISE EXCEPTION 'That opportunity belongs to a different Property.'; END IF;
  ELSIF opportunity.task_type='multi_property' AND cardinality(chosen)=0 THEN
   RAISE EXCEPTION 'Select the opportunity properties this activity involved.';
   ELSIF opportunity.task_type='program_wide' AND opportunity.property_id IS NOT NULL THEN
   RAISE EXCEPTION 'The program-wide opportunity has conflicting Property context.';
  END IF;
  context_ids:=chosen;
  IF opportunity.property_id IS NOT NULL THEN context_ids:=array_append(context_ids,opportunity.property_id); END IF;
  FOR link IN SELECT r.property_id FROM public.owner_review_properties r WHERE r.review_id=opportunity.id ORDER BY r.property_id FOR SHARE NOWAIT LOOP
   context_ids:=array_append(context_ids,link.property_id);
   IF opportunity.task_type='property_specific' AND link.property_id IS DISTINCT FROM opportunity.property_id THEN
    RAISE EXCEPTION 'The opportunity Property links changed. Ask the team to reconcile them.';
   END IF;
   END LOOP;
  IF opportunity.task_type='multi_property' AND EXISTS(SELECT 1 FROM unnest(chosen) p WHERE NOT EXISTS(
   SELECT 1 FROM public.owner_review_properties r WHERE r.review_id=opportunity.id AND r.property_id=p
  )) THEN RAISE EXCEPTION 'That Property is not assigned to this participation opportunity.'; END IF;
 END IF;
 FOR chosen_property IN SELECT DISTINCT p FROM unnest(context_ids) p ORDER BY p LOOP
  SELECT * INTO enrollment FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.property_id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR enrollment.inclusion_status IS DISTINCT FROM 'included' OR enrollment.archived_at IS NOT NULL
   OR enrollment.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Tag only homes included in this program.';
   END IF;
  SELECT * INTO home FROM public.properties h WHERE h.id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.archived_at IS NOT NULL
   OR home.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'That Property is no longer available to this Owner.'; END IF;
 END LOOP;
 IF NOT manual THEN
  IF nullif(_entry->>'ticketId','')::uuid IS DISTINCT FROM opportunity.ticket_id THEN
   RAISE EXCEPTION 'Time must retain its participation opportunity Ticket link.';
  END IF;
  IF opportunity.ticket_id IS NOT NULL THEN
    SELECT * INTO ticket FROM public.tickets WHERE id=opportunity.ticket_id FOR SHARE NOWAIT;
   IF NOT FOUND OR ticket.property_id IS DISTINCT FROM opportunity.property_id OR NOT ticket.property_id=ANY(chosen)
    OR ticket.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The opportunity Ticket context changed.'; END IF;
  END IF;
 END IF;
 -- Double save guard (Nov 21): the same homeowner, program, date, minutes and description saved in the
 -- last 10 minutes is already on file.
 IF private.owner_time_recent_repeat(program.id,auth.uid(),entry_day,reported_minutes,trim(_entry->>'activity'),NULL,NULL) THEN
  RAISE EXCEPTION 'Already saved.';
 END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,attachment_paths,review_id,ticket_id,attested,is_demo,owner_update_revision,review_status)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),paths,opportunity.id,opportunity.ticket_id,true,program.is_demo,
  CASE WHEN manual THEN NULL ELSE nullif(_entry->>'ownerUpdateRevision','')::integer END,'submitted')
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
  UPDATE public.owner_program_properties e SET last_owner_activity_at=now() WHERE e.program_id=program.id AND e.property_id=ANY(chosen);
 UPDATE public.owner_programs SET last_owner_activity_at=now() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text||' minutes reported: '||trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
  jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory','selfRecorded',manual,'attachmentCount',jsonb_array_length(paths)));
 RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or opportunity is being updated. Refresh and try again.';
END $function$;

-- 3. Edit and Add more (the homeowner-reopen action, two checks added).
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
    -- Double save guard (Nov 21): a second click on Save finds her change already on file.
    IF private.owner_time_recent_repeat(program.id, uid,
         CASE WHEN mode = 'edit' THEN coalesce(nullif(_change->>'entryDate', '')::date, original.entry_date) ELSE original.entry_date END,
         CASE WHEN mode = 'edit' THEN coalesce(nullif(_change->>'minutes', '')::integer, original.minutes) ELSE original.minutes END,
         CASE WHEN mode = 'edit' THEN btrim(coalesce(_change->>'activity', original.activity)) ELSE original.activity END,
         _change->>'note', original.id) THEN
      RAISE EXCEPTION 'Already saved.';
    END IF;
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

  -- Double save guard (Nov 21): the same date, minutes and description saved in the last 10 minutes
  -- (other than this entry and the versions before it) is already on file.
  IF private.owner_time_recent_repeat(program.id, uid, day, mins, act, note, original.id) THEN
    RAISE EXCEPTION 'Already saved.';
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

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'hours_double_save.apply', 'function', 'homeowner hours double save guard',
  'Homeowner hour saves (log, edit, add more) refuse a repeat of the same date, minutes and description saved in the last 10 minutes: "Already saved." Undo: docs/pending/hours-double-save/apply.undo.sql.');

-- ===== Practice cases (DEMO Willow Creek Cottage, demo owner). =====
DO $practice$
DECLARE o text := ''; P uuid := 'e341b2b0-a6cf-40b3-9d1c-ff7584aec196'; OWNER text := 'b1d78033-d2d4-4e05-8b2d-3c1cbcd8a443';
  H uuid := 'a0000000-0000-4000-8000-00000000a001'; d date := private.business_today(); e1 uuid; e1b uuid; e2 uuid; e3 uuid; e4 uuid; t text;
  base jsonb;
BEGIN
  base := jsonb_build_object('programId', P, 'phase', 'ongoing', 'entryDate', d, 'minutes', 20, 'activity', 'Practice double save check',
    'attachmentPaths', '[]'::jsonb, 'confirmed', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OWNER, 'role', 'authenticated')::text, true);
  e1 := public.log_owner_time_entry(base, ARRAY[H]);
  o := o || '1 first log saved; ';
  BEGIN PERFORM public.log_owner_time_entry(base, ARRAY[H]); o := o || 'FAILED repeat saved; ';
  EXCEPTION WHEN OTHERS THEN o := o || '2 same again: ' || SQLERRM || '; '; END;
  BEGIN PERFORM public.log_owner_time_entry(base || '{"activity":"  practice   DOUBLE save check "}'::jsonb, ARRAY[H]); o := o || 'FAILED spacing saved; ';
  EXCEPTION WHEN OTHERS THEN o := o || '3 spacing and capitals: ' || SQLERRM || '; '; END;
  e1b := public.log_owner_time_entry(base || '{"minutes":21}'::jsonb, ARRAY[H]);
  o := o || '4 different minutes saved; ';
  e2 := public.owner_update_time_entry(e1, '{"mode":"edit","minutes":30}'::jsonb);
  o := o || '5 edit saved, amends first ' || ((SELECT amends_entry_id FROM public.owner_time_entries WHERE id = e2) = e1) || '; ';
  BEGIN PERFORM public.owner_update_time_entry(e1, '{"mode":"edit","minutes":30}'::jsonb); o := o || 'FAILED edit twice; ';
  EXCEPTION WHEN OTHERS THEN o := o || '6 edit clicked twice: ' || SQLERRM || '; '; END;
  e3 := public.owner_update_time_entry(e2, '{"mode":"add","note":"Receipt from the hardware store"}'::jsonb);
  o := o || '7 add more saved; ';
  BEGIN PERFORM public.owner_update_time_entry(e2, '{"mode":"add","note":"Receipt from the hardware store"}'::jsonb); o := o || 'FAILED add twice; ';
  EXCEPTION WHEN OTHERS THEN o := o || '8 add more clicked twice: ' || SQLERRM || '; '; END;
  e4 := public.owner_update_time_entry(e3, '{"mode":"add","note":"Second note"}'::jsonb);
  o := o || '9 a different add more on the newest version saved; ';
  BEGIN PERFORM public.owner_update_time_entry(e2, '{"mode":"add","note":"Another note"}'::jsonb); o := o || 'FAILED stale; ';
  EXCEPTION WHEN OTHERS THEN o := o || '10 older version, new note: ' || SQLERRM || '; '; END;
  BEGIN PERFORM public.owner_update_time_entry(e1b, '{"mode":"edit","minutes":30}'::jsonb); o := o || 'FAILED edit into repeat; ';
  EXCEPTION WHEN OTHERS THEN o := o || '11 edit into a copy of another recent entry: ' || SQLERRM || '; '; END;
  SELECT format('12 totals: %s current entries, %s minutes, %s saved in all; ', count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id)),
    sum(minutes) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id)), count(*))
    INTO t FROM public.owner_time_entries e WHERE program_id = P; o := o || t;
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO _out(line) VALUES (o);
END $practice$;
-- ===== apply.undo.sql (unchanged) =====
-- Undo for hours-double-save: puts back today's Log hours action and the homeowner-reopen Edit and Add more
-- action exactly, then removes the rule. Entries saved meanwhile stay.
CREATE OR REPLACE FUNCTION public.log_owner_time_entry(_entry jsonb, _property_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; opportunity public.owner_reviews; enrollment public.owner_program_properties;
 home public.properties; link record; chosen uuid[]; context_ids uuid[]; chosen_property uuid;
 entry_day date; reported_minutes integer; new_id uuid; ticket public.tickets; manual boolean;
 paths jsonb; path_item text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record participation.'; END IF;
 IF _entry IS NULL OR jsonb_typeof(_entry) IS DISTINCT FROM 'object' OR (_entry->'confirmed') IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'Confirm that this entry records the time you personally spent.';
 END IF;
 program:=private.lock_owner_time_program((_entry->>'programId')::uuid,auth.uid(),false,true);
 entry_day:=(_entry->>'entryDate')::date; reported_minutes:=(_entry->>'minutes')::integer;
 manual:=nullif(_entry->>'reviewId','') IS NULL;
 IF entry_day IS NULL OR NOT isfinite(entry_day) OR entry_day>private.business_today() THEN
  RAISE EXCEPTION 'Choose a date no later than today.';
 END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440
  OR length(trim(coalesce(_entry->>'activity',''))) NOT BETWEEN 3 AND 500
  OR coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing')
  OR length(coalesce(_entry->>'activityCategory',''))>80 OR length(coalesce(_entry->>'output',''))>1000
  OR length(coalesce(_entry->>'comments',''))>1000 OR length(coalesce(_entry->>'attachmentPath',''))>400 THEN
   RAISE EXCEPTION 'Enter the actual activity, phase and minutes within the allowed limits.';
 END IF;
 paths:=coalesce(_entry->'attachmentPaths','[]'::jsonb);
 IF jsonb_typeof(paths) IS DISTINCT FROM 'array' OR jsonb_array_length(paths)>10 THEN
  RAISE EXCEPTION 'Attach at most ten files to one entry.';
 END IF;
 FOR path_item IN SELECT jsonb_array_elements_text(paths) LOOP
  IF path_item IS NULL OR length(trim(path_item)) NOT BETWEEN 1 AND 400 THEN
   RAISE EXCEPTION 'One of the attached files could not be recorded. Try again.';
   END IF;
 END LOOP;
 IF jsonb_array_length(paths)>0 AND nullif(_entry->>'attachmentPath','') IS DISTINCT FROM (paths->>0) THEN
  RAISE EXCEPTION 'The attached files could not be recorded. Try again.';
 END IF;
 IF cardinality(coalesce(_property_ids,'{}'::uuid[]))>25 OR array_position(_property_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Choose at most 25 valid properties.';
 END IF;
 SELECT coalesce(array_agg(DISTINCT p ORDER BY p),'{}'::uuid[]) INTO chosen FROM unnest(coalesce(_property_ids,'{}'::uuid[])) p;
 IF manual THEN
   IF nullif(_entry->>'ticketId','') IS NOT NULL THEN
   RAISE EXCEPTION 'A self-recorded activity cannot carry a Ticket link.';
  END IF;
  context_ids:=chosen;
 ELSE
  SELECT * INTO opportunity FROM public.owner_reviews WHERE id=(_entry->>'reviewId')::uuid AND program_id=program.id FOR SHARE NOWAIT;
  IF NOT FOUND OR opportunity.archived_at IS NOT NULL OR opportunity.is_demo IS DISTINCT FROM program.is_demo
   OR coalesce(opportunity.status,'') NOT IN ('awaiting_owner','answered','returned') OR opportunity.available_from>now() OR opportunity.available_from::date>entry_day
   OR opportunity.phase IS DISTINCT FROM (_entry->>'phase') THEN
   RAISE EXCEPTION 'Choose an available participation opportunity from this program.';
   END IF;
  IF opportunity.task_type NOT IN ('property_specific','multi_property','program_wide') OR opportunity.task_type IS NULL THEN
   RAISE EXCEPTION 'This opportunity needs a valid participation scope.';
  END IF;
  IF opportunity.task_type='property_specific' THEN
   IF opportunity.property_id IS NULL THEN RAISE EXCEPTION 'This opportunity needs its canonical Property.'; END IF;
   IF cardinality(chosen)=0 THEN chosen:=ARRAY[opportunity.property_id]; END IF;
   IF chosen IS DISTINCT FROM ARRAY[opportunity.property_id] THEN RAISE EXCEPTION 'That opportunity belongs to a different Property.'; END IF;
  ELSIF opportunity.task_type='multi_property' AND cardinality(chosen)=0 THEN
   RAISE EXCEPTION 'Select the opportunity properties this activity involved.';
   ELSIF opportunity.task_type='program_wide' AND opportunity.property_id IS NOT NULL THEN
   RAISE EXCEPTION 'The program-wide opportunity has conflicting Property context.';
  END IF;
  context_ids:=chosen;
  IF opportunity.property_id IS NOT NULL THEN context_ids:=array_append(context_ids,opportunity.property_id); END IF;
  FOR link IN SELECT r.property_id FROM public.owner_review_properties r WHERE r.review_id=opportunity.id ORDER BY r.property_id FOR SHARE NOWAIT LOOP
   context_ids:=array_append(context_ids,link.property_id);
   IF opportunity.task_type='property_specific' AND link.property_id IS DISTINCT FROM opportunity.property_id THEN
    RAISE EXCEPTION 'The opportunity Property links changed. Ask the team to reconcile them.';
   END IF;
   END LOOP;
  IF opportunity.task_type='multi_property' AND EXISTS(SELECT 1 FROM unnest(chosen) p WHERE NOT EXISTS(
   SELECT 1 FROM public.owner_review_properties r WHERE r.review_id=opportunity.id AND r.property_id=p
  )) THEN RAISE EXCEPTION 'That Property is not assigned to this participation opportunity.'; END IF;
 END IF;
 FOR chosen_property IN SELECT DISTINCT p FROM unnest(context_ids) p ORDER BY p LOOP
  SELECT * INTO enrollment FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.property_id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR enrollment.inclusion_status IS DISTINCT FROM 'included' OR enrollment.archived_at IS NOT NULL
   OR enrollment.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Tag only homes included in this program.';
   END IF;
  SELECT * INTO home FROM public.properties h WHERE h.id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.archived_at IS NOT NULL
   OR home.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'That Property is no longer available to this Owner.'; END IF;
 END LOOP;
 IF NOT manual THEN
  IF nullif(_entry->>'ticketId','')::uuid IS DISTINCT FROM opportunity.ticket_id THEN
   RAISE EXCEPTION 'Time must retain its participation opportunity Ticket link.';
  END IF;
  IF opportunity.ticket_id IS NOT NULL THEN
    SELECT * INTO ticket FROM public.tickets WHERE id=opportunity.ticket_id FOR SHARE NOWAIT;
   IF NOT FOUND OR ticket.property_id IS DISTINCT FROM opportunity.property_id OR NOT ticket.property_id=ANY(chosen)
    OR ticket.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The opportunity Ticket context changed.'; END IF;
  END IF;
 END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,attachment_paths,review_id,ticket_id,attested,is_demo,owner_update_revision,review_status)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),paths,opportunity.id,opportunity.ticket_id,true,program.is_demo,
  CASE WHEN manual THEN NULL ELSE nullif(_entry->>'ownerUpdateRevision','')::integer END,'submitted')
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
  UPDATE public.owner_program_properties e SET last_owner_activity_at=now() WHERE e.program_id=program.id AND e.property_id=ANY(chosen);
 UPDATE public.owner_programs SET last_owner_activity_at=now() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text||' minutes reported: '||trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
  jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory','selfRecorded',manual,'attachmentCount',jsonb_array_length(paths)));
 RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or opportunity is being updated. Refresh and try again.';
END $function$;

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
DROP FUNCTION IF EXISTS private.owner_time_recent_repeat(uuid, uuid, date, integer, text, text, uuid);
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'hours_double_save.undo', 'function', 'homeowner hours double save guard',
  'Undo of hours-double-save: Log hours and Edit or Add more restored to the earlier versions.');

DO $after$
DECLARE P uuid := 'e341b2b0-a6cf-40b3-9d1c-ff7584aec196'; OWNER text := 'b1d78033-d2d4-4e05-8b2d-3c1cbcd8a443';
  H uuid := 'a0000000-0000-4000-8000-00000000a001'; o text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OWNER, 'role', 'authenticated')::text, true);
  PERFORM public.log_owner_time_entry(jsonb_build_object('programId', P, 'phase', 'ongoing', 'entryDate', private.business_today(), 'minutes', 20,
    'activity', 'Practice double save check', 'attachmentPaths', '[]'::jsonb, 'confirmed', true), ARRAY[H]);
  PERFORM set_config('request.jwt.claims', '', true);
  o := format('13 after undo: the same repeat saves again; log action back to today''s %s; rule removed %s; edit action back to homeowner-reopen %s',
    (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.log_owner_time_entry(jsonb,uuid[])'::regprocedure) = 'eebeaa3064236750e229914ce101b3af',
    to_regprocedure('private.owner_time_recent_repeat(uuid,uuid,date,integer,text,text,uuid)') IS NULL,
    (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.owner_update_time_entry(uuid,jsonb)'::regprocedure) = 'f360b0cfed229f21574863e160365db7');
  RAISE EXCEPTION 'PRACTICE ROLLED BACK: % | %', (SELECT string_agg(line, ' | ' ORDER BY n) FROM _out), o;
END $after$;
