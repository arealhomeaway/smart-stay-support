-- UNDO 0160: restore per-Opportunity notify trigger (7a718fb8c81339a31e9392e96c58ee4886aad0bebf989034768288c072ae4de7) and drop batch helpers.
CREATE OR REPLACE FUNCTION public.notify_owner_of_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$


DROP FUNCTION IF EXISTS public.owner_release_batch_begin();
DROP FUNCTION IF EXISTS public.owner_release_summary(uuid,int,uuid[]);
