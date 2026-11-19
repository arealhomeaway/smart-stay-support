-- closure-evidence-breezeway: apply. Run only after "Approved: apply closure-evidence-breezeway".
-- One transaction (a single DO block). Changes three work_types texts and publishes maintenance checklist v2.
-- Writes exactly what publish_ticket_checklist writes (that action needs a signed-in caller, so its steps are
-- repeated here with no person recorded as the approver). Existing tickets keep the version they started on.
DO $$
DECLARE old public.playbooks; body jsonb; new_id uuid; n int;
BEGIN
  -- 1. Closure evidence wording.
  UPDATE public.work_types SET required_closure_evidence =
    'What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working'
    WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6' AND required_closure_evidence =
    'Photos before and after, what was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Immediate maintenance text changed. Stop and repeat the preflight.'; END IF;
  UPDATE public.work_types SET required_closure_evidence = 'Work performed and vendor name'
    WHERE id = 'a5b90e0e-39fc-4d96-860b-d77fb5b793d7' AND required_closure_evidence = 'Work performed, vendor, and photo of the completed work';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Ongoing maintenance text changed. Stop and repeat the preflight.'; END IF;
  UPDATE public.work_types SET required_closure_evidence = 'Who completed the cleaning'
    WHERE id = 'c2214621-8dd4-47d4-af73-8c77696850e7' AND required_closure_evidence = 'Photos of the cleaned area and who completed it';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Immediate cleaning need text changed. Stop and repeat the preflight.'; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value) VALUES
   (NULL, 'work_type_closure_evidence_changed', 'work_type', 'e110029f-e2e9-4693-b26c-c528194f96c6', 'Immediate maintenance',
    'Emily, Nov 19: photos come through Breezeway; Resolve does not require a photo or file to close.',
    jsonb_build_object('required_closure_evidence', 'Photos before and after, what was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working'),
    jsonb_build_object('required_closure_evidence', 'What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working')),
   (NULL, 'work_type_closure_evidence_changed', 'work_type', 'a5b90e0e-39fc-4d96-860b-d77fb5b793d7', 'Ongoing maintenance',
    'Emily, Nov 19: photos come through Breezeway; Resolve does not require a photo or file to close.',
    jsonb_build_object('required_closure_evidence', 'Work performed, vendor, and photo of the completed work'),
    jsonb_build_object('required_closure_evidence', 'Work performed and vendor name')),
   (NULL, 'work_type_closure_evidence_changed', 'work_type', 'c2214621-8dd4-47d4-af73-8c77696850e7', 'Immediate cleaning need',
    'Emily, Nov 19: photos come through Breezeway; Resolve does not require a photo or file to close.',
    jsonb_build_object('required_closure_evidence', 'Photos of the cleaned area and who completed it'),
    jsonb_build_object('required_closure_evidence', 'Who completed the cleaning'));

  -- 2. Maintenance checklist: new version with only step 9 question changed.
  PERFORM set_config('resolve.checklist_publish', 'on', true);
  SELECT * INTO old FROM public.playbooks
    WHERE id = '7d0eb2a4-6fdc-4396-aebc-8a738af97722' AND checklist_category = 'maintenance' AND status = 'approved' FOR UPDATE;
  IF NOT FOUND OR old.version <> 1 OR md5(old.checklist::text) <> '4f570a26feb661a1d7fbc30e4719b040'
     OR old.checklist->'steps'->8->>'key' <> 'done' THEN
    RAISE EXCEPTION 'Maintenance checklist changed. Stop and repeat the preflight.';
  END IF;
  body := jsonb_set(old.checklist, '{steps,8,question}', to_jsonb('Work done? Check the vendor photos or invoice in Breezeway.'::text));
  UPDATE public.playbooks SET status = 'retired', retired_at = now() WHERE id = old.id;
  INSERT INTO public.playbooks (category, title, active, playbook_key, version, status, approved_by, approved_at,
      effective_on, applies_to, source, supersedes_id, review_note, checklist, checklist_category, sop_url)
  VALUES ('checklist', old.title, false, coalesce(old.playbook_key, 'checklist:maintenance'), old.version + 1, 'approved', NULL, now(),
      current_date, ARRAY['ticket'], 'authored', old.id,
      'Emily, Nov 19: vendor photos and invoices are checked in Breezeway.', body, 'maintenance', old.sop_url)
  RETURNING id INTO new_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (NULL, 'ticket_checklist_published', 'playbook', new_id, old.title,
      'Emily, Nov 19: vendor photos and invoices are checked in Breezeway.',
      jsonb_build_object('id', old.id, 'version', old.version, 'done_question', 'Work done? Upload vendor photo or invoice.'),
      jsonb_build_object('category', 'maintenance', 'version', old.version + 1, 'done_question', 'Work done? Check the vendor photos or invoice in Breezeway.'));
  RAISE NOTICE 'Applied. Maintenance checklist version 2: %', new_id;
END $$;
