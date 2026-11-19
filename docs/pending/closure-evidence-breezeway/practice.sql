-- closure-evidence-breezeway: practice. apply.sql, checks, apply.undo.sql, checks, then a forced error so
-- nothing is kept. Generated from apply.sql and apply.undo.sql.
DO $$
DECLARE out text := ''; r text; n int;
BEGIN
  DECLARE
 old public.playbooks; body jsonb; new_id uuid; n int;
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
  END;

  -- Checks after apply.
  SELECT string_agg(name||'='||required_closure_evidence, ' | ' ORDER BY name) INTO r FROM public.work_types
    WHERE id IN ('e110029f-e2e9-4693-b26c-c528194f96c6','a5b90e0e-39fc-4d96-860b-d77fb5b793d7','c2214621-8dd4-47d4-af73-8c77696850e7');
  out := out || 'AFTER APPLY: ' || r;
  SELECT count(*) INTO n FROM public.work_types
    WHERE id IN ('e110029f-e2e9-4693-b26c-c528194f96c6','a5b90e0e-39fc-4d96-860b-d77fb5b793d7','c2214621-8dd4-47d4-af73-8c77696850e7')
    AND required_closure_evidence ~* '\m(photo|photos|photograph|picture|pictures|image|images|video|videos|receipt|receipts|invoice|invoices|attachment|attachments|upload|uploads|scan|scans|document|documents|pdf|screenshot|screenshots)\M';
  out := out || ' || still asking for a file: ' || n;
  SELECT 'v'||version||' '||status||' done='||(checklist->'steps'->8->>'question')||' same_otherwise='||
     ((checklist #- '{steps,8,question}') = ((SELECT checklist FROM public.playbooks WHERE id='7d0eb2a4-6fdc-4396-aebc-8a738af97722') #- '{steps,8,question}'))::text
    INTO r FROM public.playbooks WHERE checklist_category='maintenance' AND status='approved' AND checklist IS NOT NULL;
  out := out || ' || live: ' || r;
  SELECT status INTO r FROM public.playbooks WHERE id='7d0eb2a4-6fdc-4396-aebc-8a738af97722';
  out := out || ' || v1: ' || r;
  SELECT count(*) INTO n FROM public.tickets WHERE checklist_playbook_id='7d0eb2a4-6fdc-4396-aebc-8a738af97722';
  out := out || ' || tickets still on v1: ' || n;
  SELECT count(*) INTO n FROM public.ticket_steps ts WHERE to_jsonb(ts)::text ILIKE '%upload vendor photo%';
  out := out || ' || ticket steps with old words: ' || n;
  SELECT count(*) INTO n FROM public.audit_log WHERE created_at = now() AND action IN ('work_type_closure_evidence_changed','ticket_checklist_published');
  out := out || ' || audit rows: ' || n;

  DECLARE
 cur public.playbooks; orig jsonb; new_id uuid; n int;
BEGIN
  UPDATE public.work_types SET required_closure_evidence =
    'Photos before and after, what was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working'
    WHERE id = 'e110029f-e2e9-4693-b26c-c528194f96c6' AND required_closure_evidence =
    'What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Immediate maintenance text is not the applied text.'; END IF;
  UPDATE public.work_types SET required_closure_evidence = 'Work performed, vendor, and photo of the completed work'
    WHERE id = 'a5b90e0e-39fc-4d96-860b-d77fb5b793d7' AND required_closure_evidence = 'Work performed and vendor name';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Ongoing maintenance text is not the applied text.'; END IF;
  UPDATE public.work_types SET required_closure_evidence = 'Photos of the cleaned area and who completed it'
    WHERE id = 'c2214621-8dd4-47d4-af73-8c77696850e7' AND required_closure_evidence = 'Who completed the cleaning';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Immediate cleaning need text is not the applied text.'; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason)
  SELECT NULL, 'work_type_closure_evidence_restored', 'work_type', id, name, 'Undo of closure-evidence-breezeway'
    FROM public.work_types WHERE id IN ('e110029f-e2e9-4693-b26c-c528194f96c6','a5b90e0e-39fc-4d96-860b-d77fb5b793d7','c2214621-8dd4-47d4-af73-8c77696850e7');

  PERFORM set_config('resolve.checklist_publish', 'on', true);
  SELECT * INTO cur FROM public.playbooks
    WHERE checklist IS NOT NULL AND checklist_category = 'maintenance' AND status = 'approved' FOR UPDATE;
  IF cur.id IS NULL OR cur.supersedes_id IS DISTINCT FROM '7d0eb2a4-6fdc-4396-aebc-8a738af97722'::uuid THEN
    RAISE EXCEPTION 'The live maintenance checklist is not the version this package published.';
  END IF;
  SELECT checklist INTO orig FROM public.playbooks WHERE id = '7d0eb2a4-6fdc-4396-aebc-8a738af97722';
  IF md5(orig::text) <> '4f570a26feb661a1d7fbc30e4719b040' THEN RAISE EXCEPTION 'Version 1 body differs.'; END IF;
  UPDATE public.playbooks SET status = 'retired', retired_at = now() WHERE id = cur.id;
  INSERT INTO public.playbooks (category, title, active, playbook_key, version, status, approved_by, approved_at,
      effective_on, applies_to, source, supersedes_id, review_note, checklist, checklist_category, sop_url)
  VALUES ('checklist', cur.title, false, cur.playbook_key, cur.version + 1, 'approved', NULL, now(), current_date,
      ARRAY['ticket'], 'authored', cur.id, 'Undo of closure-evidence-breezeway', orig, 'maintenance', cur.sop_url)
  RETURNING id INTO new_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (NULL, 'ticket_checklist_published', 'playbook', new_id, cur.title, 'Undo of closure-evidence-breezeway',
      jsonb_build_object('id', cur.id, 'version', cur.version), jsonb_build_object('category', 'maintenance', 'version', cur.version + 1));
  END;

  SELECT string_agg(name||'='||required_closure_evidence, ' | ' ORDER BY name) INTO r FROM public.work_types
    WHERE id IN ('e110029f-e2e9-4693-b26c-c528194f96c6','a5b90e0e-39fc-4d96-860b-d77fb5b793d7','c2214621-8dd4-47d4-af73-8c77696850e7');
  out := out || ' ##### AFTER UNDO: ' || r;
  SELECT 'v'||version||' md5='||md5(checklist::text) INTO r FROM public.playbooks
    WHERE checklist_category='maintenance' AND status='approved' AND checklist IS NOT NULL;
  out := out || ' || live: ' || r;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK. %', out;
END $$;
