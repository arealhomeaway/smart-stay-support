CREATE OR REPLACE FUNCTION private.guard_owner_lifecycle_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE trusted boolean:=current_user=(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text)'::regprocedure);
 changed boolean; review public.owner_reviews; BEGIN
 IF TG_TABLE_NAME='owner_programs' THEN
  IF TG_OP='UPDATE' AND OLD.completion_report IS NOT NULL AND (NEW.completion_report IS DISTINCT FROM OLD.completion_report OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
   OR NEW.completed_by IS DISTINCT FROM OLD.completed_by OR NEW.status IS DISTINCT FROM OLD.status) THEN RAISE EXCEPTION 'The saved closeout report and completed lifecycle are immutable.'; END IF;
  IF TG_OP='UPDATE' AND (NEW.owner_record_id IS DISTINCT FROM OLD.owner_record_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo)
   AND (OLD.owner_record_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_program_events e WHERE e.program_id=OLD.id)) THEN RAISE EXCEPTION 'Preserve the program canonical Owner, original Property and demo identity.'; END IF;
  IF TG_OP='UPDATE' THEN
   changed:=(to_jsonb(NEW)-ARRAY['updated_at','report_version','last_owner_activity_at','notify_email','notify_sms_p1','notify_push','owner_phone','owner_user_id'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','report_version','last_owner_activity_at','notify_email','notify_sms_p1','notify_push','owner_phone','owner_user_id']);
  ELSE changed:=true; END IF;
  IF TG_OP='DELETE' AND NOT(OLD.is_demo AND trusted AND coalesce(public.has_role(auth.uid(),'admin'),false)) THEN RAISE EXCEPTION 'Retain program history; archive through a reviewed lifecycle action.'; END IF;
  IF changed AND NOT trusted THEN RAISE EXCEPTION 'Change owner program lifecycle and setup through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_program_properties' THEN
  IF TG_OP='UPDATE' AND (NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo) THEN RAISE EXCEPTION 'Enrollment identity is immutable. Retain its history.'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Remove enrollment without deleting its history.'; END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change owner enrollment through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_reviews' THEN
  IF TG_OP='UPDATE' AND NEW.auto_ticket IS DISTINCT FROM OLD.auto_ticket THEN RAISE EXCEPTION 'Preserve the published opportunity source and revision model.'; END IF;
  -- Manual/roadmap content is published on insertion and has no revision editor.
  -- Automatic Ticket projections retain their separate immutable update receipts.
  IF TG_OP='UPDATE' AND NOT OLD.auto_ticket AND (
   (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(NEW)) WHERE key=ANY(ARRAY['title','business_question','recommendation','evidence','impact','outcome','photos','attachment_path','owner_action_type','decision_path']))
   IS DISTINCT FROM
   (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(OLD)) WHERE key=ANY(ARRAY['title','business_question','recommendation','evidence','impact','outcome','photos','attachment_path','owner_action_type','decision_path']))
  ) THEN RAISE EXCEPTION 'Published manual opportunity context is immutable. Preserve the narrative the owner reviewed.'; END IF;
  IF TG_OP IN('UPDATE','DELETE') AND (OLD.responded_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_time_entries t WHERE t.review_id=OLD.id)) THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain the opportunity and its participation history.'; END IF;
   IF NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
    OR NEW.onboarding_task_id IS DISTINCT FROM OLD.onboarding_task_id OR NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'The source and Property identity of participated opportunities are immutable.';
   END IF;
  END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change owner opportunities through the checked atomic actions.'; END IF;
 ELSIF TG_TABLE_NAME='owner_review_properties' THEN
  SELECT * INTO review FROM public.owner_reviews WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.review_id ELSE NEW.review_id END;
  IF review.responded_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.owner_time_entries t WHERE t.review_id=review.id) THEN
   IF TG_OP<>'INSERT' OR NOT EXISTS(SELECT 1 FROM public.owner_review_properties p WHERE p.review_id=NEW.review_id AND p.property_id=NEW.property_id) THEN
    RAISE EXCEPTION 'Retain the Property links of participated opportunities.';
   END IF;
  END IF;
  IF NOT trusted THEN RAISE EXCEPTION 'Change opportunity Property links through the checked atomic actions.'; END IF;
 ELSE
  IF TG_OP IN('UPDATE','DELETE') THEN RAISE EXCEPTION 'Owner program history is immutable.'; END IF;
  IF NEW.kind IN('program_created','property_added','property_removed','closing_confirmed','program_updated','status_changed','roadmap_seeded','opportunity_created','opportunity_closed','program_completed','program_activated')
   AND NOT trusted THEN RAISE EXCEPTION 'Record lifecycle history through the checked atomic action.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $function$

