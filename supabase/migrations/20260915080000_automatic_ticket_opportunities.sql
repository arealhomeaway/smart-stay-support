-- Unapplied. Reuse canonical opportunity IDs; never overwrite a decision or a time link.
ALTER TABLE public.owner_reviews ADD COLUMN auto_ticket boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.sync_ticket_opportunities(_property_id uuid,_ticket_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item record; opportunity uuid;
BEGIN
 FOR item IN
   SELECT p.id AS program_id,t.id AS ticket_id,t.ref,t.is_demo
   FROM public.owner_programs p
   JOIN public.owner_program_properties e ON e.program_id=p.id AND e.inclusion_status='included'
   JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=p.owner_record_id
   JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
   JOIN public.tickets t ON t.property_id=h.id AND t.is_demo=p.is_demo
   WHERE h.id=_property_id AND h.is_demo=p.is_demo AND p.archived_at IS NULL
     AND p.status NOT IN ('closed','completed') AND (_ticket_id IS NULL OR t.id=_ticket_id)
   ORDER BY p.id,t.id
 LOOP
   opportunity := NULL;
   INSERT INTO public.owner_reviews(program_id,property_id,ticket_id,source_type,task_type,phase,stage,
     title,recommendation,business_question,decision_path,owner_action_type,status,is_demo,auto_ticket)
   VALUES(item.program_id,_property_id,item.ticket_id,'operations','property_specific','ongoing','operations',
     'Property work · Ticket #'||item.ref,
     'Review the linked Ticket for current status and authority. A detailed work summary is pending publication.',
     'Review the recorded work and its current owner request. Log only time you actually spend participating.',
     'inform','information_only','awaiting_owner',item.is_demo,true)
   ON CONFLICT (program_id,ticket_id) WHERE ticket_id IS NOT NULL DO NOTHING
   RETURNING id INTO opportunity;
   IF opportunity IS NULL THEN
     SELECT id INTO opportunity FROM public.owner_reviews
       WHERE program_id=item.program_id AND ticket_id=item.ticket_id AND property_id=_property_id;
   END IF;
   IF opportunity IS NOT NULL THEN
     INSERT INTO public.owner_review_properties(review_id,property_id) VALUES(opportunity,_property_id)
       ON CONFLICT (review_id,property_id) DO NOTHING;
   END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.sync_ticket_opportunities(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sync_ticket_opportunity_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE home record;
BEGIN
 IF TG_TABLE_NAME='tickets' THEN
   PERFORM public.sync_ticket_opportunities(NEW.property_id,NEW.id);
 ELSIF TG_TABLE_NAME='owner_program_properties' THEN
   IF NEW.inclusion_status='included' THEN PERFORM public.sync_ticket_opportunities(NEW.property_id); END IF;
 ELSIF TG_TABLE_NAME='owner_programs' THEN
   FOR home IN SELECT property_id FROM public.owner_program_properties WHERE program_id=NEW.id AND inclusion_status='included' ORDER BY property_id LOOP
     PERFORM public.sync_ticket_opportunities(home.property_id);
   END LOOP;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_ticket_opportunity_trigger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tickets_owner_opportunity AFTER INSERT OR UPDATE ON public.tickets
 FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_opportunity_trigger();
CREATE TRIGGER enrollment_ticket_opportunities AFTER INSERT OR UPDATE OF inclusion_status,property_id,program_id ON public.owner_program_properties
 FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_opportunity_trigger();
CREATE TRIGGER program_ticket_opportunities AFTER UPDATE OF owner_record_id,status,archived_at ON public.owner_programs
 FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_opportunity_trigger();

-- Ordinary Ticket alerts already cover these changes; automatic coverage must not double notifications.
DROP TRIGGER owner_reviews_notify_owner ON public.owner_reviews;
CREATE TRIGGER owner_reviews_notify_owner AFTER INSERT OR UPDATE ON public.owner_reviews
 FOR EACH ROW WHEN (NOT NEW.auto_ticket) EXECUTE FUNCTION public.notify_owner_of_review();

-- Covers existing canonical enrollments without guessing legacy Owner identity.
DO $$ DECLARE home record; BEGIN
 FOR home IN SELECT DISTINCT property_id FROM public.owner_program_properties WHERE inclusion_status='included' ORDER BY property_id LOOP
   PERFORM public.sync_ticket_opportunities(home.property_id);
 END LOOP;
END $$;
