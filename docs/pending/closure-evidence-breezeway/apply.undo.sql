-- closure-evidence-breezeway: undo. Needs its own approval. Restores the three old texts and republishes the
-- original maintenance checklist body as version 3. Versions 1 and 2 and every ticket pin stay as they are
-- (tickets started on version 2 keep version 2).
DO $$
DECLARE cur public.playbooks; orig jsonb; new_id uuid; n int;
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
END $$;
