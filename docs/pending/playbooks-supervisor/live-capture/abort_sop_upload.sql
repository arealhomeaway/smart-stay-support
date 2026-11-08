CREATE OR REPLACE FUNCTION public.abort_sop_upload(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_playbooks(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Directors can upload SOPs.'; END IF;
 DELETE FROM sop_versions WHERE id=_id AND uploaded_by=auth.uid() AND state='reserved';
END $function$
