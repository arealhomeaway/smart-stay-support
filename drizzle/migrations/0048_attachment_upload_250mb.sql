CREATE OR REPLACE FUNCTION public.begin_attachment_upload(_actor_id uuid, _input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE staff boolean;ctx jsonb;d public.documents;r public.documents;p public.owner_programs;req uuid:=nullif(_input->>'fulfilsRequestId','')::uuid;k uuid:=(_input->>'uploadKey')::uuid;vis text;path text:=_input->>'path';
BEGIN
 staff:=private.attachment_actor(_actor_id);
 ctx:=private.attachment_context(_input->>'entityType',(_input->>'entityId')::uuid);
 IF NOT staff AND NOT private.owner_current_property_for_actor(_actor_id,(ctx->>'propertyId')::uuid,NULL) THEN RAISE EXCEPTION 'Document access denied'; END IF;
 IF staff AND (ctx->>'closed')::boolean AND NOT public.is_supervisor(_actor_id) THEN RAISE EXCEPTION 'A supervisor must attach files to a closed record'; END IF;
 vis:=CASE WHEN staff THEN coalesce(_input->>'visibility','internal') ELSE 'owner_shared' END;
 IF vis NOT IN ('internal','owner_shared') OR nullif(_input->>'filename','') IS NULL OR nullif(_input->>'mimeType','') IS NULL OR nullif(_input->>'kind','') IS NULL OR k IS NULL OR _input->>'sizeBytes' IS NULL OR (_input->>'sizeBytes')::bigint NOT BETWEEN 1 AND 262144000 OR path IS NULL OR path NOT LIKE (_input->>'entityType')||'/'||(_input->>'entityId')||'/'||k::text||'-%' THEN RAISE EXCEPTION 'Invalid upload intent'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('attachment-upload:'||k::text,0));
 SELECT * INTO d FROM public.documents WHERE upload_key=k::text FOR UPDATE NOWAIT;
 IF FOUND THEN
  IF ROW(d.uploaded_by,d.entity_type,d.entity_id,d.property_id,d.is_demo,d.original_filename,d.mime_type,d.size_bytes,d.storage_path,d.fulfils_request_id,d.note,d.category)
   IS DISTINCT FROM ROW(_actor_id,_input->>'entityType',(_input->>'entityId')::uuid,(ctx->>'propertyId')::uuid,(ctx->>'isDemo')::boolean,_input->>'filename',_input->>'mimeType',(_input->>'sizeBytes')::bigint,path,req,_input->>'note',CASE WHEN _input->>'entityType'='property' THEN coalesce(_input->>'category','other') ELSE NULL END)
   OR d.deleted_at IS NOT NULL OR d.archived_at IS NOT NULL OR d.upload_status NOT IN ('pending','stored') THEN RAISE EXCEPTION 'Upload key belongs to a different or completed attempt'; END IF;
  IF NOT staff AND NOT public.owner_document_access(d.id,_actor_id) THEN RAISE EXCEPTION 'Document recipient changed'; END IF;
  RETURN jsonb_build_object('documentId',d.id,'path',d.storage_path,'alreadyStored',d.upload_status='stored');
 END IF;
 IF req IS NOT NULL THEN
  SELECT * INTO r FROM public.documents WHERE id=req FOR UPDATE NOWAIT;
  IF NOT FOUND OR ROW(r.entity_type,r.entity_id,r.property_id,r.is_demo) IS DISTINCT FROM ROW(_input->>'entityType',(_input->>'entityId')::uuid,(ctx->>'propertyId')::uuid,(ctx->>'isDemo')::boolean)
   OR r.requested_from IS DISTINCT FROM 'owner' OR r.visibility<>'owner_shared' OR r.upload_status<>'pending' OR r.uploaded_by IS NOT NULL OR r.storage_path IS NOT NULL OR r.deleted_at IS NOT NULL OR r.archived_at IS NOT NULL OR r.fulfilled_by_document_id IS NOT NULL THEN RAISE EXCEPTION 'Document request is no longer open on this record'; END IF;
 ELSIF NOT staff AND _input->>'entityType'<>'property' THEN RAISE EXCEPTION 'Your coordinator has not requested a document here'; END IF;
 IF vis='owner_shared' OR req IS NOT NULL THEN
  p:=private.attachment_recipient((ctx->>'propertyId')::uuid,(ctx->>'isDemo')::boolean);
  IF req IS NOT NULL AND ROW(r.owner_recipient_id,r.owner_recipient_program_id) IS DISTINCT FROM ROW(p.owner_record_id,p.id) THEN RAISE EXCEPTION 'Request recipient changed; staff must review and re-share'; END IF;
  IF NOT staff AND NOT private.owner_current_property_for_actor(_actor_id,(ctx->>'propertyId')::uuid,p.id) THEN RAISE EXCEPTION 'Document recipient access denied'; END IF;
 END IF;
 INSERT INTO public.documents(entity_type,entity_id,property_id,title,original_filename,mime_type,size_bytes,kind,visibility,storage_path,upload_key,upload_status,uploaded_by,note,category,is_demo,owner_recipient_id,owner_recipient_program_id,fulfils_request_id)
 VALUES(_input->>'entityType',(_input->>'entityId')::uuid,(ctx->>'propertyId')::uuid,_input->>'filename',_input->>'filename',_input->>'mimeType',(_input->>'sizeBytes')::bigint,_input->>'kind',vis,path,k::text,'pending',_actor_id,_input->>'note',CASE WHEN _input->>'entityType'='property' THEN coalesce(_input->>'category','other') END,(ctx->>'isDemo')::boolean,p.owner_record_id,p.id,req) RETURNING * INTO d;
 IF p.id IS NOT NULL THEN INSERT INTO public.document_recipient_events(document_id,owner_id,program_id,actor_id,event) VALUES(d.id,p.owner_record_id,p.id,_actor_id,'upload_started'); END IF;
 RETURN jsonb_build_object('documentId',d.id,'path',d.storage_path,'alreadyStored',false);
END $function$;