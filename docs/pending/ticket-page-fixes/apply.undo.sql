-- ticket-page-fixes: undo. Needs its own approval. Puts the answer guard back exactly, restores the
-- Immediate maintenance text, and republishes the version 2 checklist body as a new version.
-- Answers already edited stay as edited; their history lines stay.
DO $do$
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
END $do$;
