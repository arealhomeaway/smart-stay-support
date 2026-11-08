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
END $function$
