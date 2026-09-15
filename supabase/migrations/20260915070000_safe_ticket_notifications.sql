-- Unapplied to shared/live. Preserve existing trigger privileges and notification preferences.
-- New alerts use canonical enrollment and fixed text; historical rows are not rewritten.
CREATE OR REPLACE FUNCTION public.notify_owner_of_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prog record; k text; t text; b text; urgent boolean;
BEGIN
 IF NEW.property_id IS NULL OR coalesce(NEW.is_demo,false) THEN RETURN NEW; END IF;
 urgent := lower(coalesce(NEW.priority,''))='p1';
 IF TG_OP='INSERT' THEN
   k := CASE WHEN urgent THEN 'ticket_p1' ELSE 'ticket_opened' END;
 ELSIF NEW.status IN ('resolved','closed') AND OLD.status IS DISTINCT FROM NEW.status THEN
   k := 'ticket_resolved';
 ELSIF urgent AND lower(coalesce(OLD.priority,''))<>'p1' THEN
   k := 'ticket_p1';
 ELSE RETURN NEW;
 END IF;
 t := CASE k WHEN 'ticket_p1' THEN 'Urgent property work update'
   WHEN 'ticket_resolved' THEN 'Property work marked resolved' ELSE 'Property work update' END;
 b := 'Open your owner portal to review the recorded property work and whether an owner response is required.';
 FOR prog IN
   SELECT p.id,p.owner_user_id,p.notify_email,p.notify_sms_p1
   FROM public.owner_programs p
   JOIN public.properties h ON h.id=NEW.property_id AND h.owner_record_id=p.owner_record_id
   JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
   WHERE p.owner_record_id IS NOT NULL AND p.status IN ('pending','active')
     AND p.archived_at IS NULL AND NOT p.is_demo AND NOT h.is_demo
     AND EXISTS(SELECT 1 FROM public.owner_program_properties e
       WHERE e.program_id=p.id AND e.property_id=h.id AND e.inclusion_status='included')
 LOOP
   INSERT INTO public.owner_notifications(program_id,owner_user_id,ticket_id,kind,priority,title,body,action_path,email_status,sms_status)
   VALUES(prog.id,prog.owner_user_id,NEW.id,k,
     CASE WHEN NEW.priority IN ('p1','p2','p3') THEN NEW.priority ELSE 'p3' END,
     t,b,'/owner',CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,
     CASE WHEN urgent AND prog.notify_sms_p1 THEN 'pending' ELSE 'skipped' END);
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_owner_of_ticket() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.notify_owner_of_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prog record; home_id uuid;
BEGIN
 IF NEW.status<>'awaiting_owner' OR coalesce(NEW.is_demo,false) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='awaiting_owner' THEN RETURN NEW; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.notify_owner_of_review() FROM PUBLIC,anon,authenticated;
