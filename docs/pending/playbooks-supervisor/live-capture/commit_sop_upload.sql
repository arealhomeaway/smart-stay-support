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
END $function$
