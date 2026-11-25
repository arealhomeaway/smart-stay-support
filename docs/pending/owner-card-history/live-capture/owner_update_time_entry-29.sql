CREATE OR REPLACE FUNCTION public.owner_update_time_entry(_entry_id uuid, _change jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  IF length(coalesce(act, '')) < 3 THEN RAISE EXCEPTION 'What did you do? needs at least 3 characters.'; END IF;
  IF length(act) > 2000 THEN RAISE EXCEPTION 'What did you do? can be up to 2,000 characters.'; END IF;
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
END $function$
;
