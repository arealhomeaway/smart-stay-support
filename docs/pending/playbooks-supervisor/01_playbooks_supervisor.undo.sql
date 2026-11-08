-- Undo for 01_playbooks_supervisor.sql: restores the six live definitions read on Nov 8, 2026
-- (live-capture/), byte for byte. History rows written meanwhile stay.

CREATE OR REPLACE FUNCTION public.change_playbook_state(_id uuid, _expected_updated_at timestamp with time zone, _action text, _note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _actor uuid:=auth.uid(); _old public.playbooks; _sibling public.playbooks; _key text; _to text; _role text;
BEGIN
  IF _actor IS NULL OR NOT public.is_internal_staff(_actor) THEN RAISE EXCEPTION 'Staff access required.'; END IF;
  IF _action NOT IN ('approve','archive','note','submit') THEN RAISE EXCEPTION 'Invalid playbook action.'; END IF;
  IF _action IN ('approve','archive') AND NOT public.can_manage_playbooks(_actor) THEN RAISE EXCEPTION 'Only Admins and Directors can approve or archive playbooks.'; END IF;
  SELECT * INTO _old FROM public.playbooks WHERE id=_id;
  IF NOT FOUND OR _old.checklist IS NOT NULL THEN RAISE EXCEPTION 'Ordinary playbook not found.'; END IF;
  _key:=coalesce(_old.playbook_key,_old.id::text);
  PERFORM pg_advisory_xact_lock(hashtext('playbook:'||_key));
  SELECT * INTO _old FROM public.playbooks WHERE id=_id FOR UPDATE;
  IF _old.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'This playbook changed. Reopen it before saving.'; END IF;
  IF _action='approve' AND _old.status NOT IN ('draft','in_review') THEN RAISE EXCEPTION 'Only a draft or review version can be approved.'; END IF;
  IF _action='submit' AND _old.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be sent for review.'; END IF;
  IF _action='note' AND nullif(trim(_note),'') IS NULL THEN RAISE EXCEPTION 'Write a review note first.'; END IF;
  PERFORM set_config('resolve.playbook_write','on',true);
  _role:=CASE WHEN public.has_role(_actor,'admin') THEN 'admin' WHEN public.is_director(_actor) THEN 'director_ops' WHEN public.is_onboarding_director(_actor) THEN 'onboarding_director' ELSE 'staff' END;
  _to:=CASE _action WHEN 'approve' THEN 'approved' WHEN 'archive' THEN 'retired' WHEN 'submit' THEN 'in_review' ELSE _old.status END;
  IF _action='approve' THEN
    FOR _sibling IN SELECT * FROM public.playbooks WHERE coalesce(playbook_key,id::text)=_key AND id<>_id AND checklist IS NULL AND status IN ('active','approved') FOR UPDATE LOOP
      UPDATE public.playbooks SET status='retired',active=false,retired_at=now() WHERE id=_sibling.id;
      INSERT INTO public.playbook_approvals(playbook_id,from_status,to_status,actor_id,actor_role,note,version) VALUES(_sibling.id,_sibling.status,'retired',_actor,_role,'Replaced by version '||_old.version,_sibling.version);
    END LOOP;
    UPDATE public.work_types SET playbook_id=_id WHERE playbook_id IN (SELECT id FROM public.playbooks WHERE coalesce(playbook_key,id::text)=_key AND id<>_id AND checklist IS NULL);
  END IF;
  UPDATE public.playbooks SET status=_to, review_note=nullif(trim(_note),''),
    active=CASE WHEN _action='approve' THEN true WHEN _action='archive' THEN false ELSE active END,
    approved_by=CASE WHEN _action='approve' THEN _actor ELSE approved_by END, approved_at=CASE WHEN _action='approve' THEN now() ELSE approved_at END,
    effective_on=CASE WHEN _action='approve' THEN current_date ELSE effective_on END,
    retired_at=CASE WHEN _action='archive' THEN now() ELSE retired_at END,
    submitted_by=CASE WHEN _action='submit' THEN _actor ELSE submitted_by END, submitted_at=CASE WHEN _action='submit' THEN now() ELSE submitted_at END WHERE id=_id;
  INSERT INTO public.playbook_approvals(playbook_id,from_status,to_status,actor_id,actor_role,note,version) VALUES(_id,_old.status,_to,_actor,_role,nullif(trim(_note),''),_old.version);
  RETURN jsonb_build_object('id',_id,'version',_old.version);
END $function$;

CREATE OR REPLACE FUNCTION public.reserve_sop_upload(_name text, _owner uuid, _effective_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _version integer; _id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 IF _name !~* '\.(docx|pdf)$' OR _name ~ '[\\/:*?"<>|]' OR length(_name)>200 THEN RAISE EXCEPTION 'Choose a Word or PDF file with a shorter, plain file name.'; END IF;
 IF _effective_on IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=_owner) THEN RAISE EXCEPTION 'Choose an SOP owner and effective date.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('sop:'||lower(_name)));
 IF EXISTS(SELECT 1 FROM sop_versions WHERE lower(original_name)=lower(_name) AND state='reserved') THEN RAISE EXCEPTION 'This SOP has an unfinished upload. Check Admin > Integrations before trying again.'; END IF;
 SELECT coalesce(max(version),0)+1 INTO _version FROM sop_versions WHERE lower(original_name)=lower(_name);
 INSERT INTO sop_versions(title,original_name,version,owner_id,effective_on,uploaded_by) VALUES(regexp_replace(_name,'\.[^.]+$',''),_name,_version,_owner,_effective_on,auth.uid()) RETURNING id INTO _id;
 RETURN jsonb_build_object('id',_id,'version',_version);
END $function$;

CREATE OR REPLACE FUNCTION public.sop_upload_context(_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _out jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'content',to_jsonb(p),'steps',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.position),'[]') FROM playbook_steps s WHERE s.playbook_id=p.id))), '[]') INTO _out
 FROM playbooks p JOIN sop_playbooks l ON l.playbook_id=p.id JOIN sop_versions v ON v.id=l.sop_version_id
 WHERE lower(v.original_name)=lower(_name) AND v.state='saved' AND p.status IN ('approved','active') AND p.checklist IS NULL;
 RETURN _out;
END $function$;

CREATE OR REPLACE FUNCTION public.sop_upload_receipt(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 SELECT jsonb_build_object('sopId',id,'title',title,'version',version,'draftIds',draft_ids) INTO _r FROM sop_versions WHERE id=_id AND uploaded_by=auth.uid() AND state='saved';
 RETURN _r;
END $function$;

CREATE OR REPLACE FUNCTION public.commit_sop_upload(_id uuid, _file jsonb, _drafts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _s sop_versions; _d jsonb; _old playbooks; _saved jsonb; _new uuid; _ids uuid[]:='{}'; _previous uuid; _linked uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 SELECT * INTO _s FROM sop_versions WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR _s.uploaded_by<>auth.uid() THEN RAISE EXCEPTION 'Upload not found.'; END IF;
 IF _s.state='saved' THEN RETURN public.sop_upload_receipt(_id); END IF;
 IF nullif(_file->>'id','') IS NULL OR nullif(_file->>'driveId','') IS NULL OR coalesce(_file->>'url','') NOT LIKE 'https://arealhomeaway.sharepoint.com/%' OR jsonb_typeof(_drafts) IS DISTINCT FROM 'array' OR jsonb_array_length(_drafts)=0 THEN RAISE EXCEPTION 'The file and drafts could not be confirmed.'; END IF;
 -- Every active linked playbook must have exactly one suggested replacement.
 FOR _linked IN SELECT p.id FROM playbooks p JOIN sop_playbooks l ON l.playbook_id=p.id JOIN sop_versions v ON v.id=l.sop_version_id WHERE lower(v.original_name)=lower(_s.original_name) AND p.status IN ('active','approved') LOOP
  IF (SELECT count(*) FROM jsonb_array_elements(_drafts) d WHERE d->>'previousPlaybookId'=_linked::text)<>1 THEN RAISE EXCEPTION 'A linked playbook changed. Read the SOP again before saving.'; END IF;
 END LOOP;
 FOR _d IN SELECT value FROM jsonb_array_elements(_drafts) LOOP
  _previous:=nullif(_d->>'previousPlaybookId','')::uuid;
  IF _previous IS NOT NULL THEN
   SELECT p.* INTO _old FROM playbooks p JOIN sop_playbooks l ON l.playbook_id=p.id JOIN sop_versions v ON v.id=l.sop_version_id WHERE p.id=_previous AND lower(v.original_name)=lower(_s.original_name) AND p.status IN ('active','approved') FOR UPDATE OF p;
   IF NOT FOUND THEN RAISE EXCEPTION 'The linked active playbook could not be found.'; END IF;
   _saved:=public.save_playbook_draft(_old.id,_old.updated_at,_d->'content');
  ELSE
   _saved:=public.save_playbook_draft(NULL,NULL,_d->'content');
  END IF;
  _new:=(_saved->>'id')::uuid;
  UPDATE playbooks SET source='ai_draft', source_refs=ARRAY[_file->>'url'], source_version=_s.version::text, generated_at=now(), effective_on=_s.effective_on,
   matcher=matcher||jsonb_build_object('situations',coalesce(_d->'situations','[]')), active=false,status='draft' WHERE id=_new;
  INSERT INTO sop_playbooks(playbook_id,sop_version_id,checklist_categories) VALUES(_new,_id,ARRAY(SELECT jsonb_array_elements_text(coalesce(_d->'checklistCategories','[]')))) ON CONFLICT(playbook_id) DO UPDATE SET sop_version_id=excluded.sop_version_id,checklist_categories=excluded.checklist_categories;
  _ids:=array_append(_ids,_new);
 END LOOP;
 UPDATE sop_versions SET state='saved',file_url=_file->>'url',file_id=_file->>'id',drive_id=_file->>'driveId',draft_ids=_ids WHERE id=_id;
 RETURN public.sop_upload_receipt(_id);
END $function$;

CREATE OR REPLACE FUNCTION public.abort_sop_upload(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 DELETE FROM sop_versions WHERE id=_id AND uploaded_by=auth.uid() AND state='reserved';
END $function$;
