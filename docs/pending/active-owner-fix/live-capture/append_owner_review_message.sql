CREATE OR REPLACE FUNCTION public.append_owner_review_message(_id uuid, _author_type text, _name text, _event text, _body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.owner_reviews; _staff boolean; _owner uuid;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_id AND archived_at IS NULL;
 _staff:=public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
 SELECT owner_user_id INTO _owner FROM public.owner_programs WHERE id=r.program_id;
 IF auth.uid() IS NULL OR r.id IS NULL OR r.status='prepared' OR (_staff AND NOT public.active_owner_may_act(coalesce(r.is_demo,false))) OR (coalesce(private.is_synthetic_account(),false) AND NOT coalesce(r.is_demo,false)) THEN RAISE EXCEPTION 'This activity is not available.'; END IF;
 IF (_author_type IN ('staff','system') AND NOT _staff) OR (_author_type='homeowner' AND (NOT coalesce(private.is_program_member(r.program_id,auth.uid()),false) OR _staff)) THEN RAISE EXCEPTION 'Conversation author is not permitted.'; END IF;
 IF _event IS NOT NULL AND (_author_type<>'system' OR _event NOT IN ('resolved','reopened')) THEN RAISE EXCEPTION 'Invalid conversation event.'; END IF;
 INSERT INTO public.owner_request_messages(review_id,property_id,program_id,task_id,author_id,author_type,author_name,event,body,is_demo)
 VALUES(r.id,r.property_id,r.program_id,r.onboarding_task_id,auth.uid(),_author_type,_name,_event,_body,coalesce(r.is_demo,false));
 -- In-app only. No email or new notification producer is introduced by this cleanup.
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,after_value)
 VALUES(auth.uid(),'owner_activity_conversation','owner_review',r.id,r.title,jsonb_build_object('event',_event,'internal_task_changed',false));
END $function$
;
