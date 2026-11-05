BEGIN;
-- Dependency: approved playbooks-nov5/01_playbook_editing.sql must be applied first.
CREATE TABLE public.sop_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, original_name text NOT NULL,
 version integer NOT NULL CHECK(version>0), owner_id uuid NOT NULL REFERENCES public.profiles(id),
 effective_on date NOT NULL, uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
 uploaded_at timestamptz NOT NULL DEFAULT now(), file_url text, drive_id text, file_id text,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','saved')),
 draft_ids uuid[] NOT NULL DEFAULT '{}', UNIQUE(original_name,version)
);
GRANT SELECT ON public.sop_versions TO authenticated;
GRANT ALL ON public.sop_versions TO service_role;
ALTER TABLE public.sop_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sop_staff_read ON public.sop_versions FOR SELECT TO authenticated USING (state='saved' AND public.is_internal_staff(auth.uid()));
CREATE UNIQUE INDEX sop_one_upload_pending ON public.sop_versions(lower(original_name)) WHERE state='reserved';
CREATE TABLE public.sop_playbooks (
 playbook_id uuid PRIMARY KEY REFERENCES public.playbooks(id), sop_version_id uuid NOT NULL REFERENCES public.sop_versions(id),
 checklist_categories text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.sop_playbooks TO authenticated;
GRANT ALL ON public.sop_playbooks TO service_role;
ALTER TABLE public.sop_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY sop_playbook_staff_read ON public.sop_playbooks FOR SELECT TO authenticated USING(public.is_internal_staff(auth.uid()));

CREATE FUNCTION public.sop_upload_context(_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE _out jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'content',to_jsonb(p),'steps',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.position),'[]') FROM playbook_steps s WHERE s.playbook_id=p.id))), '[]') INTO _out
 FROM playbooks p JOIN sop_playbooks l ON l.playbook_id=p.id JOIN sop_versions v ON v.id=l.sop_version_id
 WHERE lower(v.original_name)=lower(_name) AND v.state='saved' AND p.status IN ('approved','active') AND p.checklist IS NULL;
 RETURN _out;
END $$;
CREATE FUNCTION public.reserve_sop_upload(_name text,_owner uuid,_effective_on date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
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
END $$;
CREATE FUNCTION public.commit_sop_upload(_id uuid,_file jsonb,_drafts jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE _s sop_versions; _d jsonb; _old playbooks; _saved jsonb; _new uuid; _ids uuid[]:='{}'; _previous uuid; _linked uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 SELECT * INTO _s FROM sop_versions WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR _s.uploaded_by<>auth.uid() THEN RAISE EXCEPTION 'Upload not found.'; END IF;
 IF _s.state='saved' THEN RETURN public.sop_upload_receipt(_id); END IF;
 IF nullif(_file->>'id','') IS NULL OR nullif(_file->>'driveId','') IS NULL OR _file->>'url' NOT LIKE 'https://arealhomeaway.sharepoint.com/%' OR jsonb_typeof(_drafts) IS DISTINCT FROM 'array' OR jsonb_array_length(_drafts)=0 THEN RAISE EXCEPTION 'The file and drafts could not be confirmed.'; END IF;
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
END $$;
CREATE FUNCTION public.sop_upload_receipt(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE _r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 SELECT jsonb_build_object('sopId',id,'title',title,'version',version,'draftIds',draft_ids) INTO _r FROM sop_versions WHERE id=_id AND uploaded_by=auth.uid() AND state='saved';
 RETURN _r;
END $$;
CREATE FUNCTION public.abort_sop_upload(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 DELETE FROM sop_versions WHERE id=_id AND uploaded_by=auth.uid() AND state='reserved';
END $$;
CREATE FUNCTION public.read_sop_playbook_links() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE _result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required.'; END IF;
 SELECT coalesce(jsonb_object_agg(l.playbook_id,jsonb_build_object('title',v.title,'version',v.version,'file_url',v.file_url,'latest_version',(SELECT max(v2.version) FROM sop_versions v2 WHERE lower(v2.original_name)=lower(v.original_name) AND v2.state='saved'))),'{}') INTO _result FROM sop_playbooks l JOIN sop_versions v ON v.id=l.sop_version_id WHERE v.state='saved';
 RETURN _result;
END $$;
-- Preserve SOP provenance when the ordinary editor creates a later draft.
CREATE FUNCTION private.copy_sop_playbook_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 INSERT INTO sop_playbooks(playbook_id,sop_version_id,checklist_categories) SELECT NEW.id,sop_version_id,checklist_categories FROM sop_playbooks WHERE playbook_id=NEW.supersedes_id ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER copy_sop_playbook_link AFTER INSERT ON public.playbooks FOR EACH ROW EXECUTE FUNCTION private.copy_sop_playbook_link();
REVOKE ALL ON FUNCTION public.sop_upload_context(text),public.reserve_sop_upload(text,uuid,date),public.commit_sop_upload(uuid,jsonb,jsonb),public.sop_upload_receipt(uuid),public.abort_sop_upload(uuid),public.read_sop_playbook_links() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sop_upload_context(text),public.reserve_sop_upload(text,uuid,date),public.commit_sop_upload(uuid,jsonb,jsonb),public.sop_upload_receipt(uuid),public.abort_sop_upload(uuid),public.read_sop_playbook_links() TO authenticated,service_role;
COMMIT;
