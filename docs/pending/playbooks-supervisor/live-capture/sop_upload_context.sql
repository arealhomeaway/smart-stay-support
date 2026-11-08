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
END $function$
