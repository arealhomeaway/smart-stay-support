-- active-owner-hours-fix (Nov 25, 2026). Apply only after: Approved: apply active-owner-hours-fix
-- Items 1 and 3: card scope value and the 2,000 character limit with field-named messages.

CREATE OR REPLACE FUNCTION private.ao_add_plan_card(_property uuid, _program uuid, _card uuid, _outcome text, _task uuid, _cov jsonb, _actor uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.ao_library_cards; rid uuid; pcid uuid; review_task uuid; demo boolean;
BEGIN
  SELECT * INTO c FROM public.ao_library_cards WHERE id = _card;
  SELECT p.is_demo OR coalesce((SELECT is_demo FROM public.properties WHERE id = _property), false) INTO demo
    FROM public.owner_programs p WHERE p.id = _program;
  IF _outcome IN ('locked', 'open') THEN
    review_task := CASE WHEN _task IS NOT NULL AND EXISTS (SELECT 1 FROM public.owner_reviews o WHERE o.onboarding_task_id = _task)
                        THEN NULL ELSE _task END;
    INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
      owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
    VALUES (_program, _property, 'onboarding', c.stage_window, c.title,
      CASE WHEN _outcome = 'locked' THEN 'Coming soon: waiting on ARHA to ' || coalesce(nullif(c.opens_text, ''), 'finish the step before this') ELSE c.why_text END,
      CASE WHEN _outcome = 'locked' THEN 'prepared' ELSE 'awaiting_owner' END,
      'onboarding', 'participate', review_task, coalesce(demo, false), _actor, 'property_specific')
    RETURNING id INTO rid;
  END IF;
  INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, owner_review_id, linked_task_id,
      covered_reason, covered_source, covered_item_id)
    VALUES (_property, _program, c.id, c.version, _outcome, rid, _task,
      CASE WHEN _outcome = 'already_covered' THEN _cov ->> 'reason' END,
      CASE WHEN _outcome = 'already_covered' THEN _cov ->> 'source' END,
      CASE WHEN _outcome = 'already_covered' THEN (_cov ->> 'item_id')::uuid END)
    RETURNING id INTO pcid;
  IF _outcome = 'open' THEN
    UPDATE public.ao_home_plan_cards SET join_outcome = 'locked' WHERE id = pcid;
    PERFORM private.ao_unlock(pcid, _actor);
    UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = pcid;
  END IF;
  RETURN pcid;
END $function$;

CREATE OR REPLACE FUNCTION public.send_task_to_owner_item(_task_id uuid, _note text, _respond_by date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE uid uuid := auth.uid(); t public.onboarding_tasks; pr public.onboarding_projects; hp jsonb; prog uuid;
  rid uuid; slot uuid; today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = _task_id AND archived_at IS NULL FOR UPDATE;
  IF uid IS NULL OR t.id IS NULL OR NOT coalesce(private.is_onboarding_staff(uid), false) THEN RAISE EXCEPTION 'That task is not available.'; END IF;
  IF coalesce(private.is_synthetic_account(), false) AND NOT coalesce(t.is_demo, false) THEN RAISE EXCEPTION 'That task is not available.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE property_id = t.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF NOT coalesce(private.is_onboarding_leader(uid) OR t.assigned_to = uid OR pr.project_manager = uid OR pr.director = uid, false) THEN
    RAISE EXCEPTION 'Only the person on this task or the home''s project lead can send it.';
  END IF;
  IF t.status = 'complete' THEN RAISE EXCEPTION 'This task is already complete.'; END IF;
  IF private.onboarding_work_locked(ARRAY[t.property_id]) THEN
    RAISE EXCEPTION 'Return the handoff before changing its onboarding work; accepted work is retained in history.';
  END IF;
  IF length(btrim(coalesce(_note, ''))) < 5 OR length(_note) > 2000 THEN RAISE EXCEPTION 'Write what you are asking the homeowner, at least a sentence.'; END IF;
  IF _respond_by IS NOT NULL AND _respond_by < today THEN RAISE EXCEPTION 'Choose an answer by date of today or later.'; END IF;
  hp := private.ao_home_program(t.property_id);
  IF hp ? 'reason' THEN RETURN jsonb_build_object('sent', false, 'reason', hp ->> 'reason'); END IF;
  prog := (hp ->> 'program_id')::uuid;
  SELECT id INTO slot FROM public.owner_reviews WHERE onboarding_task_id = t.id;
  INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
    owner_action_type, onboarding_task_id, respond_by, available_from, is_demo, created_by, task_type)
  VALUES (prog, t.property_id, 'onboarding', 'onboarding', left(t.title, 200), btrim(_note), 'awaiting_owner', 'onboarding',
    'review_comment', CASE WHEN slot IS NULL THEN t.id END, _respond_by, now(), coalesce(t.is_demo, false), uid, 'property_specific')
  RETURNING id INTO rid;
  INSERT INTO public.owner_item_task_sends(review_id, task_id, property_id, program_id, sent_by, note, is_demo)
    VALUES (rid, t.id, t.property_id, prog, uid, btrim(_note), coalesce(t.is_demo, false));
  UPDATE public.onboarding_tasks SET status = 'complete', completed_at = now(), completed_by = uid,
    evidence_note = 'Sent to the homeowner in their portal: ' || left(btrim(_note), 300)
   WHERE id = t.id;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (uid, 'owner_task_sent', 'onboarding_task', t.id, t.title,
            jsonb_build_object('ownerItem', rid, 'respondBy', _respond_by, 'taskCompleted', true));
  RETURN jsonb_build_object('sent', true, 'review_id', rid, 'completed', true);
END $function$;

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
 IF length(trim(coalesce(_entry->>'activity',''))) < 3 THEN
  RAISE EXCEPTION 'What did you do? needs at least 3 characters.';
 END IF;
 IF length(trim(coalesce(_entry->>'activity',''))) > 2000 THEN
  RAISE EXCEPTION 'What did you do? can be up to 2,000 characters.';
 END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440 THEN
  RAISE EXCEPTION 'Minutes spent must be a whole number from 1 to 1,440.';
 END IF;
 IF length(coalesce(_entry->>'output',''))>1000 OR length(coalesce(_entry->>'comments',''))>1000 THEN
  RAISE EXCEPTION 'Notes can be up to 1,000 characters.';
 END IF;
 IF coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing')
  OR length(coalesce(_entry->>'activityCategory',''))>80 OR length(coalesce(_entry->>'output',''))>1000
  OR length(coalesce(_entry->>'comments',''))>1000 OR length(coalesce(_entry->>'attachmentPath',''))>400 THEN
   RAISE EXCEPTION 'This could not save. Your entry is still here. Please try again, and if it happens again, message your ARHA contact.';
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
END $function$;

-- Backfill (item 1): only rows with a home.
UPDATE public.owner_reviews SET task_type = 'property_specific'
 WHERE task_type = 'property' AND property_id IS NOT NULL;