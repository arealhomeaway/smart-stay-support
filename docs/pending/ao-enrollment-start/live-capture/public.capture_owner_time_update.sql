CREATE OR REPLACE FUNCTION public.capture_owner_time_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE original public.owner_time_entries; p public.owner_programs; u public.ticket_owner_updates;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.owner_update_revision IS DISTINCT FROM OLD.owner_update_revision OR NEW.owner_update_snapshot IS DISTINCT FROM OLD.owner_update_snapshot
   OR (OLD.owner_update_revision IS NOT NULL AND (NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.review_id IS DISTINCT FROM OLD.review_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo)) THEN
   RAISE EXCEPTION 'The reviewed owner update is immutable. Preserve it through a correction.';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.amends_entry_id IS NOT NULL THEN
  SELECT * INTO original FROM public.owner_time_entries WHERE id=NEW.amends_entry_id;
  IF NOT FOUND OR NEW.program_id IS DISTINCT FROM original.program_id OR NEW.owner_user_id IS DISTINCT FROM original.owner_user_id
   OR NEW.ticket_id IS DISTINCT FROM original.ticket_id OR NEW.review_id IS DISTINCT FROM original.review_id OR NEW.is_demo IS DISTINCT FROM original.is_demo THEN
   RAISE EXCEPTION 'A correction must preserve the original participation context.';
  END IF;
  NEW.owner_update_revision:=original.owner_update_revision;
  NEW.owner_update_snapshot:=original.owner_update_snapshot;
  RETURN NEW;
 END IF;
 NEW.owner_update_snapshot:=NULL;
 IF NEW.owner_update_revision IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.owner_programs WHERE id=NEW.program_id FOR UPDATE;
 IF NOT FOUND OR p.owner_user_id IS DISTINCT FROM NEW.owner_user_id OR p.owner_record_id IS NULL OR p.archived_at IS NOT NULL
  OR p.is_demo IS DISTINCT FROM NEW.is_demo OR p.status NOT IN ('active','target_reached') THEN RAISE EXCEPTION 'The reviewed update program is no longer eligible.'; END IF;
 SELECT * INTO u FROM public.ticket_owner_updates WHERE ticket_id=NEW.ticket_id AND revision=NEW.owner_update_revision;
 IF NOT FOUND OR u.owner_record_id IS DISTINCT FROM p.owner_record_id OR u.is_demo IS DISTINCT FROM p.is_demo OR NEW.entry_date < u.reviewed_at::date THEN
  RAISE EXCEPTION 'Choose the owner update you reviewed on this participation date.';
 END IF;
 PERFORM 1 FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id
  WHERE h.id=u.property_id AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo AND e.program_id=p.id AND e.inclusion_status='included' FOR SHARE OF h,e;
 IF NOT FOUND THEN RAISE EXCEPTION 'The reviewed update Property is no longer included for this Owner.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=p.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is inactive.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_reviews r WHERE r.id=NEW.review_id AND r.program_id=p.id AND r.ticket_id=u.ticket_id)
 OR NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=u.ticket_id AND t.property_id=u.property_id AND t.is_demo=p.is_demo) THEN
  RAISE EXCEPTION 'The reviewed update does not match this opportunity and Ticket.';
 END IF;
 NEW.owner_update_snapshot:=jsonb_build_object('revision',u.revision,'issue',u.issue,'work_performed',u.work_performed,'outcome',u.outcome,'reviewed_at',u.reviewed_at,'owner_request_type',u.owner_request_type,'owner_request_why',u.owner_request_why);
 RETURN NEW;
END $function$
;

