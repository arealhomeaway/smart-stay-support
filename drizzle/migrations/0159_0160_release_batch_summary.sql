-- Batch releases send ONE homeowner summary (bell + email via the existing owner-alert drain
-- and its demo/test safety guard) instead of one alert per Opportunity.
-- Single Opportunities opened outside a batch keep the existing per-Opportunity alert.

-- 1. Per-Opportunity trigger stays silent only while a batch flag is set in the same transaction.
CREATE OR REPLACE FUNCTION public.notify_owner_of_review()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE prog record; home_id uuid;
BEGIN
 IF NEW.status<>'awaiting_owner' OR coalesce(NEW.is_demo,false) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='awaiting_owner' THEN RETURN NEW; END IF;
 -- Batch release: the caller writes one summary via owner_release_summary().
 IF coalesce(current_setting('resolve.owner_release_batch', true),'')='on' THEN RETURN NEW; END IF;
 SELECT p.* INTO prog FROM public.owner_programs p JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
 WHERE p.id=NEW.program_id AND p.status IN ('pending','active') AND p.archived_at IS NULL AND NOT p.is_demo;
 IF NOT FOUND THEN RETURN NEW; END IF;
 home_id := NEW.property_id;
 IF NEW.ticket_id IS NOT NULL THEN
    SELECT property_id INTO home_id FROM public.tickets WHERE id=NEW.ticket_id AND NOT is_demo;
   IF NOT FOUND OR home_id IS NULL OR home_id IS DISTINCT FROM NEW.property_id THEN RETURN NEW; END IF;
 END IF;
 IF home_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id
   WHERE h.id=home_id AND h.owner_record_id=prog.owner_record_id AND NOT h.is_demo
     AND e.program_id=prog.id AND e.inclusion_status='included'
 ) THEN RETURN NEW; END IF;
 INSERT INTO public.owner_notifications(program_id,owner_user_id,review_id,ticket_id,kind,priority,title,body,action_path,email_status,sms_status)
 VALUES(prog.id,prog.owner_user_id,NEW.id,NEW.ticket_id,'review_ready','p3','Participation opportunity ready',
    'Open your owner portal to review the opportunity and whether an owner response is required.',
   '/owner',CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,'skipped');
 RETURN NEW;
END $function$;

-- 2. Batch helpers. Begin sets the transaction-local flag; summary clears it and writes one alert.
CREATE OR REPLACE FUNCTION public.owner_release_batch_begin()
 RETURNS void LANGUAGE sql SET search_path TO 'public' AS $$ SELECT set_config('resolve.owner_release_batch','on',true); $$;

CREATE OR REPLACE FUNCTION public.owner_release_summary(_program_id uuid, _count int, _property_ids uuid[])
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.owner_release_batch_begin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_release_summary(uuid,int,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_release_summary(uuid,int,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_release_batch_begin() TO authenticated;