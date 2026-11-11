CREATE OR REPLACE FUNCTION public.manage_owner_review_conversation(_id uuid, _action text, _body text DEFAULT ''::text, _title text DEFAULT ''::text, _what text DEFAULT ''::text, _why text DEFAULT ''::text, _expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE r public.owner_reviews; _event text; _name text; _staff boolean; _owner uuid;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_id AND archived_at IS NULL FOR UPDATE;
 IF auth.uid() IS NULL OR r.id IS NULL OR r.status='prepared' THEN RAISE EXCEPTION 'This activity is not available.'; END IF;
 _staff:=public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
 SELECT owner_user_id INTO _owner FROM public.owner_programs WHERE id=r.program_id;
 IF NOT _staff AND (NOT coalesce(private.is_program_member(r.program_id,auth.uid()),false) OR _action<>'reply') THEN RAISE EXCEPTION 'Only ARHA staff can manage this conversation.'; END IF;
 IF _action='edit' THEN
 IF length(trim(_title))<3 OR length(_title)>200 OR length(_what)>5000 OR length(_why)>5000 THEN RAISE EXCEPTION 'Check the title and instructions.'; END IF;
 IF _expected_updated_at IS DISTINCT FROM r.updated_at THEN RAISE EXCEPTION 'This activity changed. Refresh before saving.'; END IF;
 UPDATE public.owner_reviews SET title=trim(_title),recommendation=_what,impact=_why WHERE id=r.id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,before_value,after_value) VALUES(auth.uid(),'owner_activity_edited','owner_review',r.id,r.title,jsonb_build_object('title',r.title,'what',r.recommendation,'why',r.impact),jsonb_build_object('title',_title,'what',_what,'why',_why));
 RETURN;
 END IF;
 IF _action NOT IN ('reply','resolve','reopen') THEN RAISE EXCEPTION 'Choose a supported conversation action.'; END IF;
 IF _action='reply' AND (length(trim(_body))<1 OR length(_body)>5000) THEN RAISE EXCEPTION 'Type a message of up to 5,000 characters.'; END IF;
 _event:=CASE _action WHEN 'resolve' THEN 'resolved' WHEN 'reopen' THEN 'reopened' ELSE NULL END;
 SELECT coalesce(full_name,CASE WHEN _staff THEN 'ARHA staff' ELSE 'The homeowner' END) INTO _name FROM public.profiles WHERE id=auth.uid();
 PERFORM public.append_owner_review_message(r.id,CASE WHEN _event IS NULL THEN CASE WHEN _staff THEN 'staff' ELSE 'homeowner' END ELSE 'system' END,coalesce(_name,'ARHA'),_event,CASE WHEN _event IS NULL THEN trim(_body) WHEN _event='resolved' THEN 'Conversation resolved by ARHA' ELSE 'Conversation reopened by ARHA' END);
 -- Conversation events do not change owner completion, hours, or the linked internal Task.
END $function$
;
