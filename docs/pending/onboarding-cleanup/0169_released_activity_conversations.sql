-- PENDING ONLY. Reuse the canonical append-only messages; no new conversation table or duplicate work item.
-- An additive review_id enables program activities to share the same history store.
ALTER TABLE public.owner_request_messages ADD COLUMN review_id uuid REFERENCES public.owner_reviews(id);
ALTER TABLE public.owner_request_messages ALTER COLUMN work_item_id DROP NOT NULL;
CREATE INDEX owner_request_messages_review_idx ON public.owner_request_messages(review_id,created_at);
CREATE POLICY "Homeowner reads released activity conversations" ON public.owner_request_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.owner_reviews r JOIN public.owner_programs p ON p.id=r.program_id WHERE r.id=review_id AND p.owner_user_id=auth.uid() AND r.archived_at IS NULL AND r.status<>'prepared'));

CREATE OR REPLACE FUNCTION public.read_owner_review_thread(_id uuid) RETURNS SETOF public.owner_request_messages
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to read the conversation.'; END IF;
 RETURN QUERY SELECT m.* FROM public.owner_request_messages m JOIN public.owner_reviews r ON r.id=m.review_id WHERE r.id=_id AND r.archived_at IS NULL ORDER BY m.created_at,m.id;
END $$;
REVOKE ALL ON FUNCTION public.read_owner_review_thread(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_review_thread(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.read_owner_review_conversations(_property_id uuid) RETURNS SETOF public.owner_request_messages
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
 IF NOT(public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can read home conversations.'; END IF;
 RETURN QUERY SELECT m.* FROM public.owner_request_messages m JOIN public.owner_reviews r ON r.id=m.review_id WHERE r.property_id=_property_id AND r.archived_at IS NULL ORDER BY m.created_at,m.id;
END $$;
REVOKE ALL ON FUNCTION public.read_owner_review_conversations(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_review_conversations(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.manage_owner_review_conversation(_id uuid,_action text,_body text DEFAULT '',_title text DEFAULT '',_what text DEFAULT '',_why text DEFAULT '',_expected_updated_at timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE r public.owner_reviews; _event text; _name text; _staff boolean; _owner uuid;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_id AND archived_at IS NULL FOR UPDATE;
 IF auth.uid() IS NULL OR r.id IS NULL OR r.status='prepared' THEN RAISE EXCEPTION 'This activity is not available.'; END IF;
 _staff:=public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
 SELECT owner_user_id INTO _owner FROM public.owner_programs WHERE id=r.program_id;
 IF NOT _staff AND (auth.uid() IS DISTINCT FROM _owner OR _action<>'reply') THEN RAISE EXCEPTION 'Only ARHA staff can manage this conversation.'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.manage_owner_review_conversation(uuid,text,text,text,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_owner_review_conversation(uuid,text,text,text,text,text,timestamptz) TO authenticated,service_role;

-- Narrow privileged insert because messages are SELECT-only and append-only.
CREATE OR REPLACE FUNCTION public.append_owner_review_message(_id uuid,_author_type text,_name text,_event text,_body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.owner_reviews; _staff boolean; _owner uuid;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_id AND archived_at IS NULL;
 _staff:=public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
 SELECT owner_user_id INTO _owner FROM public.owner_programs WHERE id=r.program_id;
 IF auth.uid() IS NULL OR r.id IS NULL OR r.status='prepared' OR NOT public.active_owner_may_act(coalesce(r.is_demo,false)) THEN RAISE EXCEPTION 'This activity is not available.'; END IF;
 IF (_author_type IN ('staff','system') AND NOT _staff) OR (_author_type='homeowner' AND (auth.uid() IS DISTINCT FROM _owner OR _staff)) THEN RAISE EXCEPTION 'Conversation author is not permitted.'; END IF;
 IF _event IS NOT NULL AND (_author_type<>'system' OR _event NOT IN ('resolved','reopened')) THEN RAISE EXCEPTION 'Invalid conversation event.'; END IF;
 INSERT INTO public.owner_request_messages(review_id,property_id,program_id,task_id,author_id,author_type,author_name,event,body,is_demo)
 VALUES(r.id,r.property_id,r.program_id,r.onboarding_task_id,auth.uid(),_author_type,_name,_event,_body,coalesce(r.is_demo,false));
 -- In-app only. No email or new notification producer is introduced by this cleanup.
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,after_value)
 VALUES(auth.uid(),'owner_activity_conversation','owner_review',r.id,r.title,jsonb_build_object('event',_event,'internal_task_changed',false));
END $$;
REVOKE ALL ON FUNCTION public.append_owner_review_message(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.append_owner_review_message(uuid,text,text,text,text) TO authenticated,service_role;
