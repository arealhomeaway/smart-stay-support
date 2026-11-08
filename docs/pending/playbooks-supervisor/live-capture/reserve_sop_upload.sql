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
END $function$
