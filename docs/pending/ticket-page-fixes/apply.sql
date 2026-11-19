-- ticket-page-fixes: apply. Run only after "Approved: apply ticket-page-fixes".
-- One transaction (a single DO block). Three changes:
--   1. private.guard_checklist_answer lets the team edit a finished checklist step on an open ticket (same row).
--   2. Immediate maintenance closing text.
--   3. Maintenance checklist version 3: step 9 answer "Uploaded" reads "Checked". New tickets only.
DO $do$
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
  RAISE NOTICE 'Applied. Maintenance checklist version 3: %', new_id;
END $do$;
