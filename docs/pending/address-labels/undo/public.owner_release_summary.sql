CREATE OR REPLACE FUNCTION public.owner_release_summary(_program_id uuid, _count integer, _property_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog record; names text[]; homes text; nid uuid;
BEGIN
 PERFORM set_config('resolve.owner_release_batch','off',true);
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only an Admin or Onboarding Director can release Opportunities.';
 END IF;
 IF coalesce(_count,0)<=0 THEN RETURN NULL; END IF;
 SELECT p.* INTO prog FROM owner_programs p JOIN property_owners o ON o.id=p.owner_record_id AND o.active
 WHERE p.id=_program_id AND p.status IN ('pending','active','target_reached') AND p.archived_at IS NULL AND NOT p.is_demo;
 IF NOT FOUND OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;  -- demo/test or unlinked: no alert at all
 SELECT array_agg(coalesce(nullif(trim(h.nickname),''),h.name) ORDER BY h.name) INTO names
 FROM properties h JOIN owner_program_properties e ON e.property_id=h.id AND e.program_id=prog.id AND e.inclusion_status='included'
 WHERE NOT h.is_demo AND (_property_ids IS NULL OR h.id=ANY(_property_ids));
 homes := CASE WHEN coalesce(array_length(names,1),0)=0 THEN 'your home'
               WHEN array_length(names,1)=1 THEN names[1]
               ELSE array_to_string(names[1:array_length(names,1)-1],', ')||' and '||names[array_length(names,1)] END;
 INSERT INTO owner_notifications(program_id,owner_user_id,review_id,ticket_id,kind,priority,title,body,action_path,email_status,sms_status)
 VALUES(prog.id,prog.owner_user_id,NULL,NULL,'review_batch_ready','p3','Your Active Owner activities are ready',
   format('We added %s %s to your portal for %s. Open your portal to see what''s next. You can work them anytime.',
           _count, CASE WHEN _count=1 THEN 'activity' ELSE 'activities' END, homes),
   '/owner',CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,'skipped')
 RETURNING id INTO nid;
 RETURN nid;
END $function$
;