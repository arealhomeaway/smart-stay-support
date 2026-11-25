-- Undo: restores the four functions exactly as captured live on Nov 25, 2026.
-- The task_type backfill is reversed from undo.csv (see README).

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
      'onboarding', 'participate', review_task, coalesce(demo, false), _actor, 'property')
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
    'review_comment', CASE WHEN slot IS NULL THEN t.id END, _respond_by, now(), coalesce(t.is_demo, false), uid, 'property')
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
-- Reverses the task_type backfill for exactly the rows in undo.csv.
UPDATE public.owner_reviews SET task_type = 'property' WHERE task_type = 'property_specific' AND id IN (
  '001501c9-8e50-4e29-8e71-ed01f9b77b05',  '0039fac4-5dc6-4ec9-91b5-fa6779756cfc',  '00702679-04a8-43d1-8089-65ea6ed7e998',  '009b7369-9772-44b7-b6e4-0c241a4630a0',  '013fd11f-e499-4f3c-9dc8-057ceea10c27',  '01be095a-f595-4ce6-a718-4bb01ff40c13',  '01e66fe3-1527-4a98-8e69-18cc36566b78',  '01e737b9-0616-472c-b93b-d2c2b3894561',  '01fdd811-6ef9-4bc4-b70d-f2495fcb1b8f',  '020d8943-3cb3-40ae-906e-36aa50cd7cc7',  '022956b6-d685-4013-a062-94f3258694de',  '02979a41-e1d5-4c35-9da5-79fd0e63d7b3',  '03465eb0-8073-4e7d-9add-b6b12b61fd28',  '037576ec-2a39-413e-af25-b57aeaf29035',  '03d5f2d7-cfea-40b1-89fc-7b966159245c',  '041c7455-4aeb-4efd-984b-f69f3cbc4839',  '048ba62d-6909-402d-804c-f2d04c20b814',  '058308d7-c78f-441e-9acf-baa390ce2a06',  '05d47db2-3299-4a41-9a78-1508a27349c0',  '06c683a9-05aa-4a42-92f6-c634013c7b00',  '07514746-155c-4797-a13e-d84e428458e5',  '0755c391-9a6a-4402-b264-a9f971bc9e38',  '079b42d4-b30e-4483-8a1e-c73912852633',  '07ef0c42-afbd-4607-a9b3-b886118bc3af',  '07fa7167-46e5-4046-b071-04cba1e1679c',  '0867920b-e6bd-4313-bb93-568ddc0e5447',  '08aaa232-4dc8-4506-8fcf-308e60773f5f',  '0901f071-a96c-46fb-834f-0564e8c2f45e',  '0a3b696d-69df-4fc2-b181-2190b086e5bf',  '0af16c23-1cf7-4910-aefd-2fd5df60fa21',  '0b61e292-2a5c-4971-b6f4-2319fec11cd8',  '0bcae91d-66b5-46b5-9429-aebac2b21374',  '0d2f3573-7c6a-40b9-b390-c78d66600546',  '0d605e5c-36b9-4fdd-b4d9-a84756c21884',  '0dafaa33-0e35-4579-92ff-399db7472a59',  '0dd1f424-0de8-4af8-8f01-ba40b58e77fe',  '0ee59c1c-fbf8-4b15-8720-155744f688e7',  '0f54458c-47f8-4851-8780-867dc89916c4',  '1054185d-b97f-4adf-9da3-25a7997165e7',  '1070fc1a-5bae-45a9-8709-38aee65464f1',  '116f8925-4386-4800-a735-dd20bfa958e4',  '14271206-1f47-41a2-b820-3c2a84e4aa25',  '14ae0fcd-559d-4f55-9907-e40ffe592ccf',  '150c318d-5c70-44ac-8fe7-38e4dae796cd',  '1524f70c-32da-4798-b0d8-acd983cc7dc4',  '16262913-5551-4789-8c94-bcc76edc5f8a',  '16981977-63b8-4e0c-b4de-441d3994826a',  '18e2636d-88c7-429d-9da0-4b3ca82da116',  '19190d46-5c04-431b-b930-f07890d06342',  '196569c3-37de-4bf3-8fce-0e6c6b0c2aad',  '19e913bd-9382-4254-9207-57f139c46422',  '19f4df9a-c568-4d34-8d35-7f9fc4fa8d42',  '1a8d6ed7-a810-45ac-bfc9-efb1449cc957',  '1ad2a88c-bb34-4b2b-85ff-a1a50b5e99f3',  '1af8b84c-3435-4318-9cbe-8c2760f6ca0a',  '1bc4a988-c971-4fed-b34c-1d872083d736',  '1cacf57d-008a-4eac-9aff-f91994b28cf6',  '1cb871aa-bd77-46fe-aa93-16ad7fbb0c56',  '1cbaab70-f18a-42a0-a3af-539a76ce688b',  '1cfe9855-83db-4ed0-8e24-b1bb2eaf30fe',  '1df390d1-40a9-4f6f-b17c-32dfead087ee',  '1f4ac28c-2d4c-4875-af5e-fb49f0fbd097',  '1fce69ba-3254-4a5f-a892-f0d315ff75a4',  '20167efa-a748-417e-8564-64343d28ff53',  '201ed73f-e0fe-408a-b93f-f8d917c32854',  '20492292-76cb-470b-8656-083b407225b9',  '20a55ed7-e102-4d11-97d0-e084a4ea89d9',  '214b2930-bd52-4173-95d4-df597b1e7381',  '238a53de-9210-42e5-aabc-b60ed554a6ee',  '23bb8d8d-a06b-41e2-9908-41d8362f0d4a',  '245f2a55-dbb6-4ca3-945b-a7bef9116725',  '2467737d-3c49-4ee8-953a-d96b1910e352',  '24c1bf8a-80d0-4cbc-a2d9-33e094033e2a',  '2573543d-e5c6-49a1-aff4-d40a80e54090',  '25c6ab12-c6d5-4baa-b33a-d40f5704098a',  '25e3a5d2-7879-43ee-bb5b-c3e16bfb1d7e',  '25e4ccce-8bd0-443c-95a8-53e7e57e6659',  '269657cc-7e1f-41d1-b350-010605cc7093',  '28c034f3-d8b3-4c25-9d0e-b1fd1e1640cf',  '28c8382f-f080-4aaf-8a5d-03189407f286',  '29250a29-7d5a-47eb-ab6d-06ce8a9c9357',  '2ad1d103-ff8e-4e08-95ae-936ea53036a0',  '2b3b3ce6-55c5-4a94-82ed-550c0bd379b9',  '2b864522-e94d-4058-b5e9-d43e1d54d6d8',  '2b9a76d2-174a-4f30-a220-ac637d2426a4',  '2bde8a04-249f-4b37-9538-06cbc6353b43',  '2f706dd6-0572-4fa1-9b4a-e8903266a03d',  '309ba84e-9021-45f6-85a1-f517b924321a',  '30a84cc2-d12b-437f-aadc-49195c8a22d6',  '330046cd-4b96-4b8e-b27f-a158567529c4',  '33211c5d-87dc-4666-84a9-2600986dc68b',  '3387c661-db4d-447f-86b2-9394600dcc2c',  '33c4bd90-8ee3-45aa-a7fb-f29c7a51ccdc',  '342c3230-fd7f-4c36-a68b-169e0a27d97d',  '3431b28d-f5f7-41fa-9e35-825c27daf608',  '34ec766a-f50d-4f5c-babd-b61cfbe5c9f0',  '37f07b6d-ec31-4531-8cdb-48a545531561',  '384df672-8812-405c-a6e6-ca5cf5276d92',  '38593798-ba1e-4279-99e8-dd255a22f903',  '3c68c700-b459-484b-9966-1939df088ab0',  '3f0242cc-008f-46b2-afd6-ed5d65cc75f3',  '3f3c47b1-9fd8-4565-bd2d-120ebdf4f888',  '3ffae683-7ba0-44b6-800c-0af42e50a6d6',  '40fbc7c6-286b-4cc6-848b-c39854001121',  '410a8ed9-e17c-41a4-9891-9f26cc427828',  '4143f477-3cac-4dc0-aef0-c1cf732d9e1c',  '42052498-18a0-45ac-86bc-9fc45f36edbb',  '430951ad-7cec-4f61-af91-531ff31432d3',  '43856267-53be-44c6-b5bc-9acb55dac555',  '440285fc-6e16-47df-8449-b55e06bdd450',  '44427373-3f15-4225-845a-c157ae5cb0ac',  '44af87e0-424e-47cf-aab8-41791afbfca0',  '458fe16e-b56e-4e02-8d3f-6a93713b2a10',  '45e784c6-66be-44bb-9656-1b46d38b2971',  '461ec59f-cb47-48f0-9c21-88855c62fd67',  '4662984b-5940-4932-8f03-dbbc7182b21b',  '4720cbbd-f42c-464d-8825-c8183c473168',  '47435d6b-f622-4726-b18c-6a52196ef683',  '47564ba4-5729-4017-b7e3-b26646c96e73',  '49b2a42f-c16d-44e7-b8f2-bbeea4ed49a5',  '4a2dbf5b-1c54-4e0c-b59f-5069fe4bb300',  '4a44b239-ac06-47fa-a35e-287601c6636f',  '4a4bbc23-d686-4b51-b8fe-97376655fa88',  '4a74d9f5-1fcd-4556-ad3a-4f2f9228f4c7',  '4b379f95-b7a4-476c-8dc9-af00164a06c0',  '4c7514b5-9d00-49e1-b4a3-f8288354da6c',  '4c774150-5437-47e2-802a-a93511c03afa',  '4cc2ccaa-8ec8-4fbd-a843-e565edee26ff',  '4d9e1079-1379-44a0-9fb7-1668772a8aca',  '4e15b6a2-6be1-4df1-ba61-9c14291cfbab',  '4e33bff8-3499-49d5-8d13-219b79cb852d',  '4edf2a08-dfd3-45e2-8523-0ea39576c9ac',  '4ef72458-a203-49c0-929c-6e51edb4ddfe',  '4f02c7fb-6b29-4391-ba4e-a53987d10fff',  '4fa1be17-5584-4f7d-bb64-2e20d4622721',  '50af3b38-e965-4948-a281-b7991f4a468c',  '50fa9711-2d9e-420b-ad0e-702b0b3921e1',  '510505f2-701a-4782-8bf4-5fae482e62c1',  '51a9dc5a-e71f-4699-93f6-62f05bf2801a',  '53aaa68f-85ae-4e66-b325-976a775a4971',  '53c20a94-84f8-474e-844a-a6651ac187eb',  '541e9f09-0b2b-4123-95e3-b974ac4d1f0f',  '5580b316-b448-4ddf-97bc-dccbf82dd362',  '55bee36b-4a08-4f26-9dd2-6739e7424bc6',  '5633e63b-c259-4566-8d45-0c41ebf712a1',  '5643d43e-4410-4f08-9219-c05b0ca24aaa',  '57806a72-a5c9-4a73-afe5-aa7dba5e6e4b',  '57812d46-afd7-44b1-9ac9-58e5c2688f25',  '59bb9d70-569a-45a4-8d53-1cc73e508ab5',  '5a14fc63-7229-4358-9478-9c1875444a2f',  '5a395d87-aa67-40a1-bd85-dfd38a421bc2',  '5ad0ed37-3fb3-42fc-9322-7c2a36a49ac1',  '5c097340-8a12-4437-9569-3c40907401cc',  '5c1d2071-bbbc-4eb2-b230-0c5118849fe7',  '5c653f81-7dfa-45d7-9fa4-f1498d58edf4',  '5fbda62c-fb6a-4b05-ade8-de03140bd4cc',  '5fd5c055-61fc-41ed-b558-9865dd667035',  '5ff8bf26-d72d-4b57-b47f-a17c21d5b22d',  '60edba50-45ca-44b6-a93b-15023c7eadeb',  '61d39480-294a-4184-8eb9-afa906eecc01',  '61ff9a4c-1cfa-44c8-a203-af4d9cbb1202',  '621ac6df-8944-4fb8-b5e2-327e642f026c',  '62d64a74-ab96-4bfd-a26f-141b934486b4',  '649028c2-187d-4e67-96f4-eb2b8ee578b0',  '658d75c3-45b7-49fd-90db-da7665c4f091',  '65b35376-915d-4648-bab2-ef891a81af90',  '65df940f-cf92-43e9-9eba-0c6b818e8484',  '66df8fbc-0dbd-463b-b5cf-93537b9dc9a2',  '674e34b4-fdcd-4c1d-a45e-86b4899aae71',  '67b091eb-38b4-4c34-859a-cb9bd85c4bfe',  '683bc794-2c20-4d01-8d57-76a5739be3db',  '68b15537-91f8-4eca-9f8c-d6dfe4874d79',  '69e4a2c1-7d53-4583-b805-cfc7a197b13b',  '6d46a30b-255a-4ba2-9aab-3b3c8a66aa8e',  '6d6b0243-b81b-4392-87ea-75a9bac23b49',  '6dfb36cd-159d-411b-b791-abc8f90f9288',  '6e36a768-5fa7-40bb-871f-482c2bd766da',  '6e402029-2323-4bdb-bc8b-ba97c52d1126',  '6ef73f8c-3b2e-4aff-901c-20770d1e49f2',  '6fac65a7-6513-49c3-b9d7-d5b37d35a776',  '70fb984e-ddc4-4d31-b68e-af07af82a30c',  '716650af-c2aa-416e-9a39-63b65b1e36a3',  '71c3b162-0eec-4dbd-bd35-c43ab7a64cdd',  '71c6762c-bd4e-45b2-81ea-81ba55b6ea3b',  '72e32501-7314-4d24-944f-2cdb85f0a49b',  '73d18393-e337-46c6-ae02-0ce5ce166fff',  '7413c705-b7b1-4fdc-88fe-7170ec655adb',  '7427b692-d3c1-41ef-9c0c-a0fefc61ede5',  '758b5f4b-b3d9-4397-8548-2be9ba7025c9',  '759f8f06-a864-4b93-9d9c-1904dad18c80',  '760c1e3e-cf54-4abb-b370-f9e6a8772e40',  '7627a430-ff0d-4291-b346-a1da4d986626',  '7669e3e8-0d42-48dc-95cd-69485185d666',  '76c7b424-2a7f-48aa-83f5-a2ee31fd71b6',  '77152f4d-6b4c-43a5-9aae-733fa40f9ab1',  '771790ac-5bb8-4d50-a0b5-3b0ad73482c6',  '77366050-4402-4104-b1cc-2ed23b825df1',  '773f5c3d-1860-4c43-8282-b1e432cb611b',  '783fb38b-c831-47bf-b485-2dd00972125f',  '785f76c4-c96b-40bf-b769-f5a4ca867749',  '793b8e17-3ea1-4d0e-9025-4ba321932d4c',  '79a4d591-09cd-463d-9183-e0f6b9f6a38e',  '79f5a789-2e6e-419c-adef-83aef523d005',  '7a275bc4-c9e9-458d-a61c-786cbff42bc3',  '7a931d57-a2ec-48c3-b357-a51887488b39',  '7b55d33b-fbd5-4f0f-a288-fbfe919edfb3',  '7b995b95-2387-4d11-88f6-8987d09c4db9',  '7bdb24aa-8279-481c-be14-26dd8a1f89fb',  '7c28628d-78fc-40eb-a6f9-e42f82108935',  '7c88fb98-5b8c-4d5a-bf0d-8076d260e956',  '7e0f2280-c799-463c-bc30-0d3ee5e2cd60',  '7eeb3606-ac12-406c-9a39-ab6f81bed063',  '7f12ad94-6daa-4cad-a1db-0309a277d0fa',  '7fb3e799-c782-4e38-8e5d-167aa2de0b83',  '80814527-9420-431c-b947-e30d871b3fdd',  '822429fd-79ea-4275-ba9b-8e6c771a35c2',  '82bc9f75-b4cc-42b7-8851-7bf6c511f260',  '84e65004-584c-48c7-944a-14e61fe1550b',  '86537c68-9085-40aa-adff-ae5815407ea5',  '866d8e67-69fe-4a86-b7da-ce93d8103c8b',  '876445ab-9958-41a3-a646-2a1fc76bcc4e',  '87908b70-8a7c-40b6-8155-126e3d2b2f0b',  '87d92b50-3594-4ff4-9573-5befc7d1beb7',  '87ec1e02-625c-4d10-889e-ec0df58cf0e3',  '889a50d5-38df-42d9-a07b-9bd5118762ae',  '88aa6e79-b012-46bc-8f36-eacd951fac94',  '890d8e9d-11bd-45ec-a2f6-eb3f66903c35',  '895ce6fd-5e4b-4637-86aa-cd7efbe17797',  '8986c32f-b17c-4d21-bddc-511fe98d7a51',  '8ac390d0-3c48-4ca1-9554-8fd840f5c25d',  '8baa33f5-a141-4842-973c-9af5e359d53a',  '8bafc685-7f12-4604-bcfd-1814c8dc46df',  '8d6573f0-1bf4-43f6-80a7-54a23faa208b',  '8dc67b03-c6c2-41e8-9e94-c2828c813885',  '8e733d93-5e45-4818-9873-5bb37259bdb8',  '8face25c-adc4-4977-b5e3-a778ca9c33d3',  '909e4fdd-bebd-4689-95cc-d618705c2735',  '918f7985-4cfe-45d2-9c1a-54f1bff30d39',  '92471df9-8ecf-44b4-acb1-4c8d44e272cc',  '9257a3f3-1081-438e-ac29-90348ddfcfc4',  '9409ccd0-3874-400f-a462-c68c4fa5f964',  '940acf19-5969-4fc0-b2b8-5d1552abbca7',  '9459617f-10e0-4692-bb33-bab8dbe43097',  '9465d4c1-7f4f-4762-b059-43f6acf0b0fe',  '955c45e8-b588-4c06-accb-2cf2d7c02ff2',  '95622dba-0ab5-4e8d-9d9b-d4fcb9416672',  '9585e6a3-9f2d-4ffd-a4a9-b449059c3fac',  '961a8e93-85c2-435d-8fd5-cb75036874ff',  '968a01d5-a93f-4e16-8a57-d8bb29d5ed18',  '968f191d-e8a9-4402-aa59-1896e7f891ca',  '96a69734-4bc9-47c8-b093-b267f1593af8',  '96ba8df4-e5ac-438c-b95b-dbc33ee1f885',  '977ce479-8750-44e0-a0aa-b1f98ab5a88e',  '97a9e1dd-a219-401f-b10f-5c7d6a580ade',  '98ccf390-f13d-4df4-9f46-57321440a16a',  '99727965-f88c-4c30-8c9f-4205dec8d90d',  '9b975267-e72b-46d9-ba18-8c30ee745cee',  '9cc10adc-54a2-4456-bedf-c2bf80b983f6',  '9cf646c7-fdf0-4978-87c0-b61dd42ab745',  '9d200955-da4d-41cd-bb4c-4df57a83ff7e',  '9f20f343-f88f-4f4c-92c6-95de6287feac',  'a06a2d29-172b-4fe2-a311-1b7f7db4aeb8',  'a12f50e0-958e-4229-b3be-f3a270463c9b',  'a1595620-15be-435d-90db-40e07be8cecb',  'a181dd52-b318-4a77-80f4-4104d0189d7b',  'a1ae122a-bacf-4187-b1d3-e5d781a5f746',  'a1fedfae-fb50-4552-a3a2-7ce626c4c154',  'a2672d75-f45a-4a1a-9efd-4f0e8615ba2b',  'a2cf5b71-3f6a-4861-a4e3-6449150a47fb',  'a32b7df3-aa91-4e43-bcdd-8245a78eae51',  'a35d78f8-36a0-461f-9fd7-5be83188bcc7',  'a48b2bf1-6c36-4e5c-bb7d-2e18790b78db',  'a49f6328-7ac7-44c4-80d2-3f61285b5ba7',  'a5129776-df93-49c4-9816-ea312d2c3271',  'a677664e-a500-4685-9991-b49b55a941f3',  'a8054674-7b44-4552-9de8-05cba722f2c4',  'a8195289-7db4-499c-984e-4abf7f33790f',  'a91f0a31-d402-4fa4-ba74-a3575339f477',  'ab8ad7e3-1020-417f-a743-4ac1f89f68df',  'abbc7ef6-54ef-4010-a5c6-d3b923065901',  'ad60bd49-4b65-4d7d-9fd2-6b1fd9daa78d',  'adcb98a9-692a-4981-9ba9-88cace22c2ac',  'ae4e9ee5-f724-424f-8452-20c48cd8a714',  'aea18ffd-f540-4e15-808d-99c4e06a1872',  'aea754ef-1e5b-43d7-98a2-f24461f053dc',  'afe47f6a-f0f8-4617-bb95-f50981269342',  'afee5c4d-6246-480e-a415-5065359f39d0',  'b00c47f9-60f6-43b3-987d-6523d38484b2',  'b09f8d7f-ddd9-4d1d-8ceb-caeeb7fc5a4c',  'b0cafd0b-16fe-4fb0-b1ad-dcf343b06a1f',  'b191b995-693d-446c-8e0c-23104293dc0d',  'b246e606-b478-4571-af6b-d74ff1007332',  'b2d48cea-3f85-4722-acaf-221ff7049587',  'b3abca5f-5b42-426c-8e4f-faaf89e463de',  'b51bc7c8-c914-4aa0-bf4d-c2ec700b9595',  'b5a49af1-d5ec-4c74-a598-ba19e5fc76d4',  'b7618b42-4209-4711-b3a0-d13c52aad19f',  'b85a2c79-a431-442c-86cb-60edc2add274',  'b9d56a1f-81f6-4536-83af-8b4bff44b072',  'baf96a93-f810-4c55-8e93-95a75b97e35d',  'bc58687c-d180-4817-82dc-d8dd035f803f',  'bc6b5314-3d97-4cc3-b69b-906c700dadf4',  'bd4b6df5-bc9d-4109-96ee-dfde41e68cbe',  'bde5ae2b-aeaa-4e63-b35d-489c54935154',  'bf117079-d735-46c7-ad12-ae0889fdd9ae',  'bf3dbd1d-5007-406b-a831-d354faf8b67e',  'bf5d290b-5afe-47c2-9c15-9d01b1d55aab',  'c05a002f-9d46-440e-97d2-ea3a94145ca4',  'c0a4f6fa-d257-454f-81b9-d34f5abdddd0',  'c0f246f8-d111-4492-8b31-78be90832919',  'c0ff4117-8aca-4bec-87e4-fa296687880b',  'c13f3f97-8bf7-44fe-a8e8-0425cf2e0768',  'c18a4da1-ef68-4dfa-9fbf-71f45109fee0',  'c3710c7a-6acc-4de5-9820-1211b9bdb421',  'c3ad36ae-4047-4636-96ca-cf3693d5e62e',  'c4ffbe18-89f6-478a-a1cd-4a7be0e721d7',  'c525386b-41e1-4125-abcb-14ba2a7acb2d',  'c54eb639-7eb5-4520-aec8-672f185a4ac5',  'c5ac5e02-c55e-4b6f-beb3-2a805196241a',  'c608e3d9-5d81-49bf-b52c-131ac49fdedd',  'c60c7f7c-9a23-4e32-971f-ef146a9ab6f6',  'c66dd0e8-2c14-41cb-8bfe-8ac149c35269',  'c67427b2-ec33-4612-a4f5-71b09ba8d1d6',  'c721d617-21b8-4bc9-9cc7-87b543eb1fd8',  'c8681c34-52d2-4866-87fa-c4d24ac10bc8',  'c968b82f-4d3c-4b18-9094-dcf3e32b735c',  'c995cba9-b0df-44c3-80dd-187d4308b3b3',  'ca99e6c9-4d4b-41e2-97ec-3a0564ad7bbf',  'cb024143-b050-4d8c-92e5-1496c5ff2ade',  'cb3874f1-bb34-489c-ba9a-873d01665435',  'cc41e0ca-0bfe-4125-815f-e8cb53a84ce2',  'cc4f5788-5fde-4cf9-8cb1-7b2001413a1a',  'cd74439f-2406-4198-83a8-e20274ee71de',  'cd837229-2862-4a63-8338-88f506fde24e',  'cdbe1704-e904-43c4-9966-e3e1ed96d78e',  'ce350393-66e8-4e3a-9989-4f60f91b17db',  'ce6f9f08-f4a5-4dc4-a208-472499a4b822',  'cea294ab-dcf5-4ee5-a6ac-442fae3b6c78',  'cf5e3edc-cef5-4c9e-8ea1-71e81389f99b',  'd01ced08-9f1c-41ee-9076-570878f1de51',  'd02ab655-8d6f-4241-95a1-1ab01f1776bb',  'd0316512-5557-4fba-b2cd-fa6ebf3a3c37',  'd28fb600-33c4-41ec-b37e-2116f1920ce4',  'd29aa7fb-1979-42d7-806b-2cfc4cc40b1c',  'd29ee6fb-7f8c-4aad-a0fb-0a77a68d9d89',  'd4f19bc3-90c5-44a9-8ba6-9b25df76e4f1',  'd620d1cd-6b6a-4ffb-8ac1-e249bafdb53a',  'd792888a-f591-496a-904b-7fb94e03df17',  'd7d67fe8-a7b9-4433-9333-04e0735ccc1c',  'd8ed36c1-fbc8-4686-b0da-501dbba5118d',  'da9a00bd-4d50-426c-a40f-ead62597c817',  'db5c536b-298d-4493-ac04-1a8f3f9fbe49',  'dbea3bce-1401-4bcb-8cfa-9260c22033d3',  'dc10484c-3f25-4160-bb2f-3ee636fa1bb2',  'dd6981d7-7983-4110-8874-86152ab2bcf4',  'dd77b123-7b74-4b76-b889-39191fe87aa5',  'de83931e-3595-4bff-99b0-7da558ac5e86',  'ded9653b-45d3-4d78-9567-34008eea02ed',  'df4d359c-27d0-4fc6-902f-31f7578524d8',  'df7bcbd5-eaef-4d5a-8645-6642dd8c6188',  'e014d0aa-e109-48f1-9105-bcb99aed922e',  'e063e413-f159-44e5-81ac-d97430cde5b9',  'e06ff141-abb7-4891-8715-f2f5473b73d8',  'e12b715e-29f9-4ee6-9350-861cea003967',  'e1815cb6-4d58-4678-9add-5d128eddc9d3',  'e271e517-03de-4b5c-aab9-a79cf0dbf4a9',  'e2a293c0-b504-4df9-8adc-53c0b12d8b15',  'e460a78d-bd69-4490-ab1f-75ec53862201',  'e4c55a9c-ea08-446e-924f-775f5e5f97bc',  'e517ee53-c946-4d3f-a09c-614914751ff2',  'e5274e2a-9a03-48a4-8571-165129589fec',  'e5943752-d7ae-427b-b9a0-e1e813ecac9d',  'e6222475-e184-47e8-b0aa-a53764cac096',  'e64908c8-4b19-4565-8cd4-6afac1512643',  'e67e5f71-0f1f-4ca4-a86a-83ad94a4c130',  'e722488e-9b35-4812-8e37-8de7836ed322',  'e760bc1c-9a05-4db6-804d-76b9fb927b6a',  'e7ae5246-21b3-494b-9df3-501e1daeb5c2',  'e8850c55-d8dc-4b0f-80fe-45ac4b3ad4b2',  'e8b05535-f54b-4efb-bd51-409781940fe4',  'ea1e0df6-2817-4446-9b10-07016ff512f9',  'ec02adee-5b83-44d3-b663-531637c510fc',  'ecacd5e6-f92e-470d-985c-08a9f3fc7a4e',  'ecc28991-7642-4abc-ab61-490fc9cf52af',  'edfbf92c-3767-46ad-932e-880d69a01a9a',  'ee03b6ec-6a7e-4672-b3c5-eb6fa239224c',  'ee239d3e-225a-4adc-ace9-227aa00e2c9e',  'ee683ac1-c231-4117-9a4e-d79dcc9a5a7b',  'eed1b069-4ccc-4105-b0e6-973f3f878ac1',  'ef01ebf1-613c-4b91-91bd-785dc2c9e65a',  'f289b07b-5cb7-4f88-9c9e-3370e5b72bce',  'f2b10a40-d637-46e3-b3ec-a00b7243e3bf',  'f2dd0bd1-10cf-401d-872a-9feb2fc3f9d4',  'f3002897-9a23-4ae9-9cf9-6c4737e7c7b2',  'f3efc734-973f-4ab0-afbf-8baef22bc4bd',  'f65721ca-58f2-4a11-bdef-377d64c15c94',  'f6a4b048-5d99-4990-9ded-b59211a4d09a',  'f6e97a27-cd84-4d0e-bdd1-3c55276ad088',  'f7819f36-5f5d-4161-9ccf-214cc1955121',  'f7a13dfb-f535-4091-952f-2f53f620639d',  'f8a3d584-6893-4c88-bbba-f3a77f5e2773',  'f96941a4-5361-44ad-ba87-13d790007d14',  'f9a2fdf4-9dc9-4cda-a1cd-4d88c12739ea',  'f9de97c2-322f-425f-94ac-89a12c8a8000',  'fa6e3a8c-48fb-4371-b6d5-8dd6d9e29d6d',  'fa7bd551-0c21-40f2-b549-11aa2da7bb6a',  'fceb666b-4261-4266-a596-b8f28c3f629d',  'fd58e1d2-c30d-4cc9-ae77-dc163e855cde',  'fdc4727d-d3bb-48c7-b0c4-9fc42d95e4d4',  'fe6210eb-9883-4ba7-9fe0-731b4fa31b21',  'ff4f97d7-6ea2-4c76-b05f-0c5c6ccdeab9'
);
