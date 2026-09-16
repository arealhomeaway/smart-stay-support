-- Existing unbound shares are deliberately NOT assigned to an inferred recipient.
ALTER TABLE public.documents
 ADD COLUMN owner_recipient_id uuid REFERENCES public.property_owners(id),
 ADD COLUMN owner_recipient_program_id uuid REFERENCES public.owner_programs(id),
 ADD COLUMN fulfils_request_id uuid REFERENCES public.documents(id),
 ADD COLUMN fulfilled_by_document_id uuid REFERENCES public.documents(id),
 ADD CONSTRAINT document_recipient_pair CHECK ((owner_recipient_id IS NULL)=(owner_recipient_program_id IS NULL));
CREATE TABLE public.document_recipient_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.documents(id),
 owner_id uuid NOT NULL REFERENCES public.property_owners(id), program_id uuid NOT NULL REFERENCES public.owner_programs(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), event text NOT NULL CHECK(event IN ('shared','requested','upload_started','uploaded','unshared')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_recipient_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.document_recipient_events TO authenticated;
GRANT SELECT,INSERT ON public.document_recipient_events TO service_role;
CREATE POLICY document_recipient_history_staff ON public.document_recipient_events FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
DROP POLICY documents_read_owner_shared ON public.documents;
DROP POLICY documents_update_sup ON public.documents;
CREATE POLICY documents_update_sup ON public.documents FOR UPDATE TO authenticated
 USING(public.is_supervisor(auth.uid()) OR (public.is_staff(auth.uid()) AND uploaded_by=auth.uid()))
 WITH CHECK(public.is_supervisor(auth.uid()) OR (public.is_staff(auth.uid()) AND uploaded_by=auth.uid()));

CREATE FUNCTION private.document_boundary_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE trusted boolean := current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.documents'::regclass));
BEGIN
 IF TG_TABLE_NAME='document_recipient_events' THEN
  IF TG_OP<>'INSERT' OR NOT trusted THEN RAISE EXCEPTION 'Document recipient history is append-only through checked writers'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NOT trusted AND (NEW.owner_recipient_id IS NOT NULL OR NEW.owner_recipient_program_id IS NOT NULL OR NEW.fulfils_request_id IS NOT NULL OR NEW.fulfilled_by_document_id IS NOT NULL)
  THEN RAISE EXCEPTION 'Use the checked document workflow'; END IF;
 ELSIF NOT trusted AND ROW(NEW.owner_recipient_id,NEW.owner_recipient_program_id,NEW.fulfils_request_id,NEW.fulfilled_by_document_id,NEW.visibility,NEW.requested_from)
  IS DISTINCT FROM ROW(OLD.owner_recipient_id,OLD.owner_recipient_program_id,OLD.fulfils_request_id,OLD.fulfilled_by_document_id,OLD.visibility,OLD.requested_from)
 THEN RAISE EXCEPTION 'Use the checked document sharing workflow';
 END IF;
 IF TG_OP='UPDATE' AND OLD.upload_key IS NOT NULL AND ROW(NEW.entity_type,NEW.entity_id,NEW.property_id,NEW.is_demo,NEW.upload_key,NEW.uploaded_by,NEW.storage_path,NEW.original_filename,NEW.mime_type,NEW.size_bytes,NEW.fulfils_request_id)
  IS DISTINCT FROM ROW(OLD.entity_type,OLD.entity_id,OLD.property_id,OLD.is_demo,OLD.upload_key,OLD.uploaded_by,OLD.storage_path,OLD.original_filename,OLD.mime_type,OLD.size_bytes,OLD.fulfils_request_id)
 THEN RAISE EXCEPTION 'Original upload intent is immutable'; END IF;
 IF TG_OP='UPDATE' AND NOT trusted AND OLD.upload_key IS NOT NULL AND ROW(NEW.upload_status,NEW.uploaded_at) IS DISTINCT FROM ROW(OLD.upload_status,OLD.uploaded_at)
 THEN RAISE EXCEPTION 'Use checked upload completion'; END IF;
 IF TG_OP='UPDATE' AND OLD.requested_from='owner' AND OLD.owner_recipient_id IS NOT NULL THEN
  IF ROW(NEW.entity_type,NEW.entity_id,NEW.property_id,NEW.is_demo,NEW.title,NEW.note,NEW.requested_from)
   IS DISTINCT FROM ROW(OLD.entity_type,OLD.entity_id,OLD.property_id,OLD.is_demo,OLD.title,OLD.note,OLD.requested_from)
  THEN RAISE EXCEPTION 'Original owner document request is immutable; create a new request'; END IF;
  IF NOT trusted AND NEW.upload_status IS DISTINCT FROM OLD.upload_status THEN RAISE EXCEPTION 'Use checked request completion'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.fulfilled_by_document_id IS NOT NULL AND ROW(NEW.fulfilled_by_document_id,NEW.upload_status) IS DISTINCT FROM ROW(OLD.fulfilled_by_document_id,OLD.upload_status)
 THEN RAISE EXCEPTION 'Document request completion receipt is immutable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.document_boundary_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER document_boundary_guard BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION private.document_boundary_guard();
CREATE TRIGGER document_recipient_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.document_recipient_events FOR EACH ROW EXECUTE FUNCTION private.document_boundary_guard();

-- Lock the current entity and Property. NOWAIT turns competing lifecycle changes
-- into an explicit retry, including callers with a different upstream lock order.
CREATE FUNCTION private.attachment_context(_type text,_id uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE h public.properties; t public.tickets; task public.onboarding_tasks; pid uuid; demo boolean; closed boolean:=false;
BEGIN
 IF _type='property' THEN pid:=_id;
 ELSIF _type='ticket' THEN SELECT * INTO t FROM public.tickets WHERE id=_id FOR SHARE NOWAIT; IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF; pid:=t.property_id;demo:=t.is_demo;closed:=t.status='closed' OR t.archived_at IS NOT NULL;
 ELSIF _type='onboarding_task' THEN SELECT * INTO task FROM public.onboarding_tasks WHERE id=_id FOR SHARE NOWAIT; IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;pid:=task.property_id;demo:=task.is_demo;closed:=task.status='complete' OR task.archived_at IS NOT NULL;
 ELSE RAISE EXCEPTION 'Unsupported attachment record'; END IF;
 IF pid IS NOT NULL THEN
  SELECT * INTO h FROM public.properties WHERE id=pid FOR SHARE NOWAIT;
  IF NOT FOUND OR h.archived_at IS NOT NULL OR (demo IS NOT NULL AND demo<>h.is_demo) THEN RAISE EXCEPTION 'Property context changed'; END IF;
  demo:=h.is_demo;
 END IF;
 RETURN jsonb_build_object('propertyId',pid,'isDemo',coalesce(demo,false),'closed',closed);
END $$;
REVOKE ALL ON FUNCTION private.attachment_context(text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.attachment_actor(_actor uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM auth.users WHERE id=_actor AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active account required'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=_actor FOR SHARE NOWAIT;
 IF NOT public.is_staff(_actor) AND (NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text='owner') OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text<>'owner'))
 THEN RAISE EXCEPTION 'Document access denied'; END IF;
 RETURN public.is_staff(_actor);
END $$;
REVOKE ALL ON FUNCTION private.attachment_actor(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.attachment_recipient(_property uuid,_demo boolean) RETURNS public.owner_programs LANGUAGE plpgsql SET search_path=public AS $$
DECLARE chosen uuid; n integer; p public.owner_programs;
BEGIN
 SELECT count(*),(array_agg(op.id))[1] INTO n,chosen FROM public.owner_programs op
 JOIN public.owner_program_properties e ON e.program_id=op.id AND e.property_id=_property AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=op.is_demo
 JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=op.owner_record_id AND h.archived_at IS NULL AND h.is_demo=op.is_demo
 JOIN public.property_owners o ON o.id=op.owner_record_id AND o.active
 WHERE op.archived_at IS NULL AND op.is_demo=_demo;
 IF n<>1 THEN RAISE EXCEPTION 'Sharing requires exactly one current canonical Owner program for this Property. Review enrollment before sharing.'; END IF;
 SELECT * INTO p FROM public.owner_programs WHERE id=chosen FOR SHARE NOWAIT;
 PERFORM 1 FROM public.owner_program_properties WHERE program_id=chosen AND property_id=_property FOR SHARE NOWAIT;
 PERFORM 1 FROM public.property_owners WHERE id=p.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.owner_program_properties e JOIN public.properties h ON h.id=e.property_id WHERE e.program_id=p.id AND e.property_id=_property AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo AND h.archived_at IS NULL) OR p.archived_at IS NOT NULL
 THEN RAISE EXCEPTION 'Owner enrollment changed'; END IF;
 RETURN p;
END $$;
REVOKE ALL ON FUNCTION private.attachment_recipient(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.owner_document_access(_document_id uuid,_actor_id uuid DEFAULT NULL) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.documents d JOIN public.owner_programs p ON p.id=d.owner_recipient_program_id AND p.owner_record_id=d.owner_recipient_id
 WHERE d.id=_document_id AND d.deleted_at IS NULL AND d.archived_at IS NULL AND NOT d.is_demo AND d.visibility='owner_shared'
 AND private.owner_current_property_for_actor(private.owner_read_actor(_actor_id),d.property_id,p.id)
 AND ((d.entity_type='property' AND d.entity_id=d.property_id)
 OR (d.entity_type='ticket' AND EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=d.entity_id AND t.property_id=d.property_id AND t.is_demo=d.is_demo))
 OR (d.entity_type='onboarding_task' AND EXISTS(SELECT 1 FROM public.onboarding_tasks t WHERE t.id=d.entity_id AND t.property_id=d.property_id AND t.is_demo=d.is_demo))))
$$;
REVOKE ALL ON FUNCTION public.owner_document_access(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_document_access(uuid,uuid) TO authenticated,service_role;

CREATE FUNCTION public.request_owner_document(_actor_id uuid,_input jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; p public.owner_programs; id uuid;
BEGIN
 IF NOT private.attachment_actor(_actor_id) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 IF nullif(trim(_input->>'title'),'') IS NULL THEN RAISE EXCEPTION 'Document title required'; END IF;
 ctx:=private.attachment_context(_input->>'entityType',(_input->>'entityId')::uuid);
 p:=private.attachment_recipient((ctx->>'propertyId')::uuid,(ctx->>'isDemo')::boolean);
 INSERT INTO public.documents(entity_type,entity_id,property_id,title,kind,visibility,requested_from,upload_status,required,note,is_demo,owner_recipient_id,owner_recipient_program_id)
 VALUES(_input->>'entityType',(_input->>'entityId')::uuid,(ctx->>'propertyId')::uuid,trim(_input->>'title'),'document','owner_shared','owner','pending',true,_input->>'note',(ctx->>'isDemo')::boolean,p.owner_record_id,p.id) RETURNING documents.id INTO id;
 INSERT INTO public.document_recipient_events(document_id,owner_id,program_id,actor_id,event) VALUES(id,p.owner_record_id,p.id,_actor_id,'requested');
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,after_value) VALUES(_actor_id,'attachment.requested_from_owner',_input->>'entityType',(_input->>'entityId')::uuid,jsonb_build_object('documentId',id,'ownerId',p.owner_record_id,'programId',p.id));
 RETURN id;
END $$;

CREATE FUNCTION public.set_attachment_visibility(_actor_id uuid,_document_id uuid,_visibility text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.documents; ctx jsonb;p public.owner_programs;
BEGIN
 IF NOT private.attachment_actor(_actor_id) OR _visibility IS NULL OR _visibility NOT IN ('internal','owner_shared') THEN RAISE EXCEPTION 'Staff access required'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=_document_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR d.deleted_at IS NOT NULL OR d.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Document unavailable'; END IF;
 ctx:=private.attachment_context(d.entity_type,d.entity_id);
 IF d.property_id IS DISTINCT FROM (ctx->>'propertyId')::uuid OR d.is_demo<>(ctx->>'isDemo')::boolean THEN RAISE EXCEPTION 'Document Property context changed'; END IF;
 IF _visibility='owner_shared' THEN
  p:=private.attachment_recipient(d.property_id,d.is_demo);
  IF d.upload_key IS NOT NULL AND d.upload_status='pending' AND ROW(d.owner_recipient_id,d.owner_recipient_program_id) IS DISTINCT FROM ROW(p.owner_record_id,p.id) THEN RAISE EXCEPTION 'Complete the original upload before changing its recipient'; END IF;
  UPDATE public.documents SET visibility=_visibility,owner_recipient_id=p.owner_record_id,owner_recipient_program_id=p.id WHERE id=d.id;
  INSERT INTO public.document_recipient_events(document_id,owner_id,program_id,actor_id,event) VALUES(d.id,p.owner_record_id,p.id,_actor_id,'shared');
 ELSE
  UPDATE public.documents SET visibility=_visibility WHERE id=d.id;
  IF d.owner_recipient_id IS NOT NULL THEN INSERT INTO public.document_recipient_events(document_id,owner_id,program_id,actor_id,event) VALUES(d.id,d.owner_recipient_id,d.owner_recipient_program_id,_actor_id,'unshared'); END IF;
 END IF;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,before_value,after_value) VALUES(_actor_id,'attachment.visibility_changed',d.entity_type,d.entity_id,jsonb_build_object('documentId',d.id,'visibility',d.visibility,'ownerId',d.owner_recipient_id,'programId',d.owner_recipient_program_id),jsonb_build_object('visibility',_visibility,'ownerId',p.owner_record_id,'programId',p.id));
 RETURN d.id;
END $$;

CREATE FUNCTION public.begin_attachment_upload(_actor_id uuid,_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE staff boolean;ctx jsonb;d public.documents;r public.documents;p public.owner_programs;req uuid:=nullif(_input->>'fulfilsRequestId','')::uuid;k uuid:=(_input->>'uploadKey')::uuid;vis text;path text:=_input->>'path';
BEGIN
 staff:=private.attachment_actor(_actor_id);
 ctx:=private.attachment_context(_input->>'entityType',(_input->>'entityId')::uuid);
 IF NOT staff AND NOT private.owner_current_property_for_actor(_actor_id,(ctx->>'propertyId')::uuid,NULL) THEN RAISE EXCEPTION 'Document access denied'; END IF;
 IF staff AND (ctx->>'closed')::boolean AND NOT public.is_supervisor(_actor_id) THEN RAISE EXCEPTION 'A supervisor must attach files to a closed record'; END IF;
 vis:=CASE WHEN staff THEN coalesce(_input->>'visibility','internal') ELSE 'owner_shared' END;
 IF vis NOT IN ('internal','owner_shared') OR nullif(_input->>'filename','') IS NULL OR nullif(_input->>'mimeType','') IS NULL OR nullif(_input->>'kind','') IS NULL OR k IS NULL OR _input->>'sizeBytes' IS NULL OR (_input->>'sizeBytes')::bigint NOT BETWEEN 1 AND 52428800 OR path IS NULL OR path NOT LIKE (_input->>'entityType')||'/'||(_input->>'entityId')||'/'||k::text||'-%' THEN RAISE EXCEPTION 'Invalid upload intent'; END IF;
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
 ELSIF NOT staff THEN RAISE EXCEPTION 'Your coordinator has not requested a document here'; END IF;
 IF vis='owner_shared' OR req IS NOT NULL THEN
  p:=private.attachment_recipient((ctx->>'propertyId')::uuid,(ctx->>'isDemo')::boolean);
  IF req IS NOT NULL AND ROW(r.owner_recipient_id,r.owner_recipient_program_id) IS DISTINCT FROM ROW(p.owner_record_id,p.id) THEN RAISE EXCEPTION 'Request recipient changed; staff must review and re-share'; END IF;
  IF NOT staff AND NOT private.owner_current_property_for_actor(_actor_id,(ctx->>'propertyId')::uuid,p.id) THEN RAISE EXCEPTION 'Document recipient access denied'; END IF;
 END IF;
 INSERT INTO public.documents(entity_type,entity_id,property_id,title,original_filename,mime_type,size_bytes,kind,visibility,storage_path,upload_key,upload_status,uploaded_by,note,category,is_demo,owner_recipient_id,owner_recipient_program_id,fulfils_request_id)
 VALUES(_input->>'entityType',(_input->>'entityId')::uuid,(ctx->>'propertyId')::uuid,_input->>'filename',_input->>'filename',_input->>'mimeType',(_input->>'sizeBytes')::bigint,_input->>'kind',vis,path,k::text,'pending',_actor_id,_input->>'note',CASE WHEN _input->>'entityType'='property' THEN coalesce(_input->>'category','other') END,(ctx->>'isDemo')::boolean,p.owner_record_id,p.id,req) RETURNING * INTO d;
 IF p.id IS NOT NULL THEN INSERT INTO public.document_recipient_events(document_id,owner_id,program_id,actor_id,event) VALUES(d.id,p.owner_record_id,p.id,_actor_id,'upload_started'); END IF;
 RETURN jsonb_build_object('documentId',d.id,'path',d.storage_path,'alreadyStored',false);
END $$;

CREATE FUNCTION public.complete_attachment_upload(_actor_id uuid,_document_id uuid,_ok boolean,_fulfils_request_id uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE staff boolean;d public.documents;r public.documents;ctx jsonb;p public.owner_programs;
BEGIN
 staff:=private.attachment_actor(_actor_id);
 IF _ok IS NULL THEN RAISE EXCEPTION 'Upload completion decision required'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=_document_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR d.deleted_at IS NOT NULL OR d.archived_at IS NOT NULL OR d.storage_path IS NULL OR d.upload_key IS NULL OR (d.uploaded_by<>_actor_id AND NOT public.is_supervisor(_actor_id)) THEN RAISE EXCEPTION 'Upload unavailable'; END IF;
 ctx:=private.attachment_context(d.entity_type,d.entity_id);
 IF staff AND (ctx->>'closed')::boolean AND NOT public.is_supervisor(_actor_id) THEN RAISE EXCEPTION 'A supervisor must complete files on a closed record'; END IF;
 IF ROW(d.property_id,d.is_demo) IS DISTINCT FROM ROW((ctx->>'propertyId')::uuid,(ctx->>'isDemo')::boolean) THEN RAISE EXCEPTION 'Upload Property context changed'; END IF;
 IF _fulfils_request_id IS NOT NULL AND _fulfils_request_id IS DISTINCT FROM d.fulfils_request_id THEN RAISE EXCEPTION 'Original document request cannot change'; END IF;
 IF NOT staff AND NOT public.owner_document_access(d.id,_actor_id) THEN RAISE EXCEPTION 'Document recipient access denied'; END IF;
 IF d.owner_recipient_id IS NOT NULL THEN
  p:=private.attachment_recipient(d.property_id,d.is_demo);
  IF ROW(d.owner_recipient_id,d.owner_recipient_program_id) IS DISTINCT FROM ROW(p.owner_record_id,p.id) THEN RAISE EXCEPTION 'Upload recipient changed'; END IF;
 END IF;
 IF d.upload_status='stored' AND _ok THEN RETURN true; END IF;
 IF d.upload_status<>'pending' THEN RAISE EXCEPTION 'Upload is no longer pending'; END IF;
 IF NOT _ok THEN UPDATE public.documents SET upload_status='failed' WHERE id=d.id;RETURN false; END IF;
 IF d.fulfils_request_id IS NOT NULL THEN
  SELECT * INTO r FROM public.documents WHERE id=d.fulfils_request_id FOR UPDATE NOWAIT;
  IF NOT FOUND OR ROW(r.entity_type,r.entity_id,r.property_id,r.is_demo,r.owner_recipient_id,r.owner_recipient_program_id) IS DISTINCT FROM ROW(d.entity_type,d.entity_id,d.property_id,d.is_demo,d.owner_recipient_id,d.owner_recipient_program_id)
  OR r.requested_from IS DISTINCT FROM 'owner' OR r.visibility<>'owner_shared' OR r.upload_status<>'pending' OR r.fulfilled_by_document_id IS NOT NULL OR r.deleted_at IS NOT NULL OR r.archived_at IS NOT NULL OR r.uploaded_by IS NOT NULL OR r.storage_path IS NOT NULL THEN RAISE EXCEPTION 'Original document request is no longer open'; END IF;
  UPDATE public.documents SET upload_status='stored',fulfilled_by_document_id=d.id WHERE id=r.id;
 END IF;
 UPDATE public.documents SET upload_status='stored',uploaded_at=now() WHERE id=d.id;
 IF d.owner_recipient_id IS NOT NULL THEN INSERT INTO public.document_recipient_events(document_id,owner_id,program_id,actor_id,event) VALUES(d.id,d.owner_recipient_id,d.owner_recipient_program_id,_actor_id,'uploaded'); END IF;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,after_value) VALUES(_actor_id,'attachment.uploaded',d.entity_type,d.entity_id,d.original_filename,jsonb_build_object('documentId',d.id,'requestId',d.fulfils_request_id,'size',d.size_bytes,'type',d.mime_type));
 IF d.entity_type='ticket' THEN INSERT INTO public.ticket_activity(ticket_id,author_id,kind,event_type,internal,body) VALUES(d.entity_id,_actor_id,'evidence','attachment_uploaded',false,'Added '||d.original_filename||'.'); END IF;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.request_owner_document(uuid,jsonb),public.set_attachment_visibility(uuid,uuid,text),public.begin_attachment_upload(uuid,jsonb),public.complete_attachment_upload(uuid,uuid,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_owner_document(uuid,jsonb),public.set_attachment_visibility(uuid,uuid,text),public.begin_attachment_upload(uuid,jsonb),public.complete_attachment_upload(uuid,uuid,boolean,uuid) TO service_role;

-- Remove from ordinary views atomically, retaining bytes and all historical links.
-- Destructive storage cleanup is deliberately a separate, unauthorized operation.
CREATE FUNCTION public.archive_attachment(_actor_id uuid,_document_id uuid,_reason text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.documents;ctx jsonb;
BEGIN
 IF NOT private.attachment_actor(_actor_id) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=_document_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR (NOT public.is_supervisor(_actor_id) AND d.uploaded_by IS DISTINCT FROM _actor_id) THEN RAISE EXCEPTION 'Only the uploader or a supervisor can remove this attachment'; END IF;
 ctx:=private.attachment_context(d.entity_type,d.entity_id);
 IF ROW(d.property_id,d.is_demo) IS DISTINCT FROM ROW((ctx->>'propertyId')::uuid,(ctx->>'isDemo')::boolean) THEN RAISE EXCEPTION 'Attachment Property context changed'; END IF;
 IF d.deleted_at IS NOT NULL THEN RETURN d.id; END IF;
 UPDATE public.documents SET deleted_at=now(),deleted_by=_actor_id,delete_reason=nullif(trim(_reason),'') WHERE id=d.id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,reason,before_value,after_value)
 VALUES(_actor_id,'attachment.removed',d.entity_type,d.entity_id,d.original_filename,_reason,jsonb_build_object('documentId',d.id,'visibility',d.visibility),jsonb_build_object('documentId',d.id,'bytesRetained',true));
 RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.archive_attachment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_attachment(uuid,uuid,text) TO service_role;
-- Guard provenance is the trusted database role, not an unforgeable call-stack marker.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=ANY(ARRAY['public.request_owner_document(uuid,jsonb)'::regprocedure,'public.set_attachment_visibility(uuid,uuid,text)'::regprocedure,'public.begin_attachment_upload(uuid,jsonb)'::regprocedure,'public.complete_attachment_upload(uuid,uuid,boolean,uuid)'::regprocedure,'public.archive_attachment(uuid,uuid,text)'::regprocedure])
 AND (NOT p.prosecdef OR p.proowner<>(SELECT relowner FROM pg_class WHERE oid='public.documents'::regclass) OR pg_get_userbyid(p.proowner) IN ('anon','authenticated','service_role'))) THEN RAISE EXCEPTION 'Document writers require the trusted documents owner'; END IF;
END $$;
