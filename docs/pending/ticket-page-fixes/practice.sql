-- ticket-page-fixes: practice. Runs apply, checks, undo, checks, then a forced error rolls everything back.
-- Uses one answered step on an open ticket (03323e8a-338a-445d-adfc-9b6d23a6163a); nothing is kept.
DO $do$
DECLARE out text := ''; r text; n int; ok boolean; before_row jsonb; after_row jsonb;
BEGIN
  DECLARE old public.playbooks; body jsonb; new_id uuid; n int;
  BEGIN
  -- 0. Refuse if anything moved since the preflight.
  IF md5(pg_get_functiondef('private.guard_checklist_answer'::regproc)) <> 'c4520d75fa033d235abd9b89a6e99995' THEN
    RAISE EXCEPTION 'The checklist answer guard changed. Stop and repeat the preflight.';
  END IF;

  -- 1. Finished checklist steps can be edited in place on an open ticket by the team.
  EXECUTE $ddl$CREATE OR REPLACE FUNCTION private.guard_checklist_answer()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $fn$
DECLARE pinned uuid; t_status text; t_archived timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.step_key IS NOT NULL THEN
      RAISE EXCEPTION 'Checklist answers are history and cannot be changed. Answer the step again instead.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.step_key IS NULL THEN RETURN NEW; END IF;
    -- Edit a finished step on an open ticket: the same row; only the answer, its details, the note and the reason change.
    IF (to_jsonb(NEW) - ARRAY['answer','answer_fields','note','not_applicable_reason'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['answer','answer_fields','note','not_applicable_reason']) THEN
      RAISE EXCEPTION 'Only the answer, its details and the note can change on a checklist step.';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT private.is_staff(auth.uid()) THEN
      RAISE EXCEPTION 'Only the team can change a checklist answer.';
    END IF;
    SELECT status::text, archived_at INTO t_status, t_archived FROM public.tickets WHERE id = OLD.ticket_id;
    IF t_status IN ('resolved', 'closed') OR t_archived IS NOT NULL THEN
      RAISE EXCEPTION 'This ticket is closed. Reopen it to change an answer.';
    END IF;
    IF NEW.answer IS NULL OR length(trim(NEW.answer)) = 0 THEN
      RAISE EXCEPTION 'Choose an answer.';
    END IF;
    IF NEW.answer = 'not_applicable' AND length(trim(coalesce(NEW.not_applicable_reason, ''))) < 3 THEN
      RAISE EXCEPTION 'Say in one line why this step does not apply.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.step_key IS NULL THEN RETURN NEW; END IF;
  SELECT checklist_playbook_id INTO pinned FROM public.tickets WHERE id = NEW.ticket_id;
  IF pinned IS NULL OR NEW.checklist_playbook_id IS DISTINCT FROM pinned THEN
    RAISE EXCEPTION 'This answer does not match the checklist version on the ticket.';
  END IF;
  IF NEW.answer IS NULL OR length(trim(NEW.answer)) = 0 THEN
    RAISE EXCEPTION 'Choose an answer.';
  END IF;
  IF NEW.answer = 'not_applicable' AND length(trim(coalesce(NEW.not_applicable_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say in one line why this step does not apply.';
  END IF;
  NEW.completed := true;
  NEW.completed_by := coalesce(NEW.completed_by, auth.uid());
  NEW.completed_at := coalesce(NEW.completed_at, now());
  RETURN NEW;
END $fn$$ddl$;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (NULL, 'checklist_answer_edit_enabled', 'function', NULL, 'private.guard_checklist_answer',
    'Nov 19 request: ticket page fixes. Team can edit a finished checklist step on an open ticket; same row, never deleted.',
    jsonb_build_object('update', 'blocked'), jsonb_build_object('update', 'answer, details, note and reason on open tickets, team only'));

  -- 2. Immediate maintenance closing text.
  UPDATE public.work_types SET required_closure_evidence = 'What was repaired or replaced; vendor name; smoke detector, CO alarm, security device all checked working'
    WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6' AND required_closure_evidence = 'What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Immediate maintenance text changed. Stop and repeat the preflight.'; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (NULL, 'work_type_closure_evidence_changed', 'work_type', 'e110029f-e2e9-4693-b26c-c528194f96c6', 'Immediate maintenance', 'Nov 19 request: ticket page fixes.',
    jsonb_build_object('required_closure_evidence', 'What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working'),
    jsonb_build_object('required_closure_evidence', 'What was repaired or replaced; vendor name; smoke detector, CO alarm, security device all checked working'));

  -- 3. Maintenance checklist: new version, only step 9 answer label "Uploaded" becomes "Checked" (value stays).
  PERFORM set_config('resolve.checklist_publish', 'on', true);
  SELECT * INTO old FROM public.playbooks
    WHERE id = 'bdaa20f2-d1d9-4258-80e0-39bc4db869cc' AND checklist_category = 'maintenance' AND status = 'approved' FOR UPDATE;
  IF NOT FOUND OR old.version <> 2 OR md5(old.checklist::text) <> 'bcf7e0b4d9f60020cc7d56df1276a8e0'
     OR old.checklist->'steps'->8->>'key' <> 'done'
     OR old.checklist->'steps'->8->'options' <> '[{"label": "Uploaded", "value": "uploaded"}]'::jsonb THEN
    RAISE EXCEPTION 'Maintenance checklist changed. Stop and repeat the preflight.';
  END IF;
  body := jsonb_set(old.checklist, '{steps,8,options,0,label}', to_jsonb('Checked'::text));
  UPDATE public.playbooks SET status = 'retired', retired_at = now() WHERE id = old.id;
  INSERT INTO public.playbooks (category, title, active, playbook_key, version, status, approved_by, approved_at,
      effective_on, applies_to, source, supersedes_id, review_note, checklist, checklist_category, sop_url)
  VALUES ('checklist', old.title, false, coalesce(old.playbook_key, 'checklist:maintenance'), old.version + 1, 'approved', NULL, now(),
      current_date, ARRAY['ticket'], 'authored', old.id, 'Nov 19 request: ticket page fixes. Step 9 answer reads Checked.', body, 'maintenance', old.sop_url)
  RETURNING id INTO new_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (NULL, 'ticket_checklist_published', 'playbook', new_id, old.title, 'Nov 19 request: ticket page fixes. Step 9 answer reads Checked.',
      jsonb_build_object('id', old.id, 'version', old.version, 'done_answer', 'Uploaded'),
      jsonb_build_object('category', 'maintenance', 'version', old.version + 1, 'done_answer', 'Checked'));
  END;

  SELECT required_closure_evidence INTO r FROM public.work_types WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6';
  out := out || 'AFTER APPLY: text=' || r;
  SELECT 'v'||version||' answer='||(checklist->'steps'->8->'options'->0->>'label')||' value='||(checklist->'steps'->8->'options'->0->>'value')
     ||' same_otherwise='||((checklist #- '{steps,8,options,0,label}') = ((SELECT checklist FROM public.playbooks WHERE id='bdaa20f2-d1d9-4258-80e0-39bc4db869cc') #- '{steps,8,options,0,label}'))::text
    INTO r FROM public.playbooks WHERE checklist_category='maintenance' AND status='approved' AND checklist IS NOT NULL;
  out := out || ' || live: ' || r;
  SELECT status INTO r FROM public.playbooks WHERE id='bdaa20f2-d1d9-4258-80e0-39bc4db869cc';
  out := out || ' || v2: ' || r;

  -- Edit as a team member: same row changes, nothing else on it.
  PERFORM set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"98bd6696-4018-4965-b645-0471c5ae3925","role":"authenticated"}', true);
  SELECT to_jsonb(ts) INTO before_row FROM public.ticket_steps ts WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
  UPDATE public.ticket_steps SET answer = 'not_applicable', not_applicable_reason = 'Practice edit' WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
  SELECT to_jsonb(ts) INTO after_row FROM public.ticket_steps ts WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
  SELECT count(*) INTO n FROM public.ticket_steps WHERE ticket_id = 'a899316b-8140-463c-bd7c-6f697b0cdd9e' AND step_key = 'done';
  out := out || ' || team edit: answer=' || (after_row->>'answer') || ' rows_for_step=' || n
     || ' other_columns_same=' || ((after_row - ARRAY['answer','not_applicable_reason']) = (before_row - ARRAY['answer','not_applicable_reason']))::text;
  BEGIN
    UPDATE public.ticket_steps SET answer = 'not_applicable', not_applicable_reason = 'x' WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
    out := out || ' || short reason: ALLOWED (bad)';
  EXCEPTION WHEN raise_exception THEN out := out || ' || short reason: blocked';
  END;
  BEGIN
    UPDATE public.ticket_steps SET completed_by = NULL WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
    out := out || ' || change who answered: ALLOWED (bad)';
  EXCEPTION WHEN raise_exception THEN out := out || ' || change who answered: blocked';
  END;
  BEGIN
    UPDATE public.ticket_steps SET step_key = 'what' WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
    out := out || ' || move to another step: ALLOWED (bad)';
  EXCEPTION WHEN raise_exception THEN out := out || ' || move to another step: blocked';
  END;
  BEGIN
    DELETE FROM public.ticket_steps WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
    out := out || ' || delete: ALLOWED (bad)';
  EXCEPTION WHEN raise_exception THEN out := out || ' || delete: blocked';
  END;
  -- Someone who is not on the team.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000beef', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000beef","role":"authenticated"}', true);
  BEGIN
    UPDATE public.ticket_steps SET answer = 'uploaded', not_applicable_reason = NULL WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
    out := out || ' || not on the team: ALLOWED (bad)';
  EXCEPTION WHEN raise_exception THEN out := out || ' || not on the team: blocked';
  END;
  -- Closed ticket (ticket triggers paused only for this one practice write).
  PERFORM set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"98bd6696-4018-4965-b645-0471c5ae3925","role":"authenticated"}', true);
  BEGIN
    SET LOCAL session_replication_role = replica;
    UPDATE public.tickets SET status = 'closed' WHERE id = 'a899316b-8140-463c-bd7c-6f697b0cdd9e';
    SET LOCAL session_replication_role = origin;
    BEGIN
      UPDATE public.ticket_steps SET answer = 'uploaded', not_applicable_reason = NULL WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
      out := out || ' || closed ticket: ALLOWED (bad)';
    EXCEPTION WHEN raise_exception THEN out := out || ' || closed ticket: blocked';
    END;
  EXCEPTION WHEN insufficient_privilege THEN out := out || ' || closed ticket: not practiced (no permission)';
  END;
  SET LOCAL session_replication_role = origin;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT count(*) INTO n FROM public.audit_log WHERE created_at = now()
    AND action IN ('checklist_answer_edit_enabled','work_type_closure_evidence_changed','ticket_checklist_published');
  out := out || ' || audit rows: ' || n;

  DECLARE cur public.playbooks; orig jsonb; new_id uuid; n int;
  BEGIN
  -- 1. The checklist answer guard back to exactly what it was (finished answers cannot be changed).
  EXECUTE $ddl$CREATE OR REPLACE FUNCTION private.guard_checklist_answer()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $fn$
DECLARE pinned uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.step_key IS NOT NULL THEN
      RAISE EXCEPTION 'Checklist answers are history and cannot be changed. Answer the step again instead.';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF NEW.step_key IS NULL THEN RETURN NEW; END IF;
  SELECT checklist_playbook_id INTO pinned FROM public.tickets WHERE id = NEW.ticket_id;
  IF pinned IS NULL OR NEW.checklist_playbook_id IS DISTINCT FROM pinned THEN
    RAISE EXCEPTION 'This answer does not match the checklist version on the ticket.';
  END IF;
  IF NEW.answer IS NULL OR length(trim(NEW.answer)) = 0 THEN
    RAISE EXCEPTION 'Choose an answer.';
  END IF;
  IF NEW.answer = 'not_applicable' AND length(trim(coalesce(NEW.not_applicable_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say in one line why this step does not apply.';
  END IF;
  NEW.completed := true;
  NEW.completed_by := coalesce(NEW.completed_by, auth.uid());
  NEW.completed_at := coalesce(NEW.completed_at, now());
  RETURN NEW;
END $fn$$ddl$;
  IF md5(pg_get_functiondef('private.guard_checklist_answer'::regproc)) <> 'c4520d75fa033d235abd9b89a6e99995' THEN
    RAISE EXCEPTION 'Restored guard does not match the original.';
  END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_label, reason)
  VALUES (NULL, 'checklist_answer_edit_disabled', 'function', 'private.guard_checklist_answer', 'Undo of ticket-page-fixes');

  -- 2. Immediate maintenance text back.
  UPDATE public.work_types SET required_closure_evidence = 'What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working'
    WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6' AND required_closure_evidence = 'What was repaired or replaced; vendor name; smoke detector, CO alarm, security device all checked working';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Immediate maintenance text is not the applied text.'; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason)
  VALUES (NULL, 'work_type_closure_evidence_restored', 'work_type', 'e110029f-e2e9-4693-b26c-c528194f96c6', 'Immediate maintenance', 'Undo of ticket-page-fixes');

  -- 3. Republish the version 2 body ("Uploaded") as a new version. Earlier versions and every ticket pin stay.
  PERFORM set_config('resolve.checklist_publish', 'on', true);
  SELECT * INTO cur FROM public.playbooks
    WHERE checklist IS NOT NULL AND checklist_category = 'maintenance' AND status = 'approved' FOR UPDATE;
  IF cur.id IS NULL OR cur.supersedes_id IS DISTINCT FROM 'bdaa20f2-d1d9-4258-80e0-39bc4db869cc'::uuid THEN
    RAISE EXCEPTION 'The live maintenance checklist is not the version this package published.';
  END IF;
  SELECT checklist INTO orig FROM public.playbooks WHERE id = 'bdaa20f2-d1d9-4258-80e0-39bc4db869cc';
  IF md5(orig::text) <> 'bcf7e0b4d9f60020cc7d56df1276a8e0' THEN RAISE EXCEPTION 'Version 2 body differs.'; END IF;
  UPDATE public.playbooks SET status = 'retired', retired_at = now() WHERE id = cur.id;
  INSERT INTO public.playbooks (category, title, active, playbook_key, version, status, approved_by, approved_at,
      effective_on, applies_to, source, supersedes_id, review_note, checklist, checklist_category, sop_url)
  VALUES ('checklist', cur.title, false, cur.playbook_key, cur.version + 1, 'approved', NULL, now(), current_date,
      ARRAY['ticket'], 'authored', cur.id, 'Undo of ticket-page-fixes', orig, 'maintenance', cur.sop_url)
  RETURNING id INTO new_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (NULL, 'ticket_checklist_published', 'playbook', new_id, cur.title, 'Undo of ticket-page-fixes',
      jsonb_build_object('id', cur.id, 'version', cur.version), jsonb_build_object('category', 'maintenance', 'version', cur.version + 1));
  END;

  SELECT required_closure_evidence INTO r FROM public.work_types WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6';
  out := out || ' ##### AFTER UNDO: text=' || r;
  SELECT 'v'||version||' md5='||md5(checklist::text) INTO r FROM public.playbooks
    WHERE checklist_category='maintenance' AND status='approved' AND checklist IS NOT NULL;
  out := out || ' || live: ' || r;
  out := out || ' || guard original=' || (md5(pg_get_functiondef('private.guard_checklist_answer'::regproc)) = 'c4520d75fa033d235abd9b89a6e99995')::text;
  BEGIN
    UPDATE public.ticket_steps SET answer = 'uploaded' WHERE id = '03323e8a-338a-445d-adfc-9b6d23a6163a';
    out := out || ' || edit after undo: ALLOWED (bad)';
  EXCEPTION WHEN raise_exception THEN out := out || ' || edit after undo: blocked';
  END;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK. %', out;
END $do$;
