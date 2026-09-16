-- Exact reviewed narrative for a participation response; never accepts browser narrative text.
CREATE FUNCTION public.read_owner_review_update(_review_id uuid,_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.owner_reviews; p public.owner_programs; u public.ticket_owner_updates;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_review_id;
 SELECT * INTO p FROM public.owner_programs WHERE id=r.program_id FOR UPDATE;
 IF p.id IS NULL OR auth.uid() IS NULL OR p.owner_user_id IS DISTINCT FROM auth.uid() OR p.is_demo IS DISTINCT FROM false
  OR p.archived_at IS NOT NULL OR p.status IN ('closed','completed') OR r.is_demo IS DISTINCT FROM p.is_demo THEN
  RAISE EXCEPTION 'This reviewed opportunity is not available.';
 END IF;
 SELECT * INTO r FROM public.owner_reviews WHERE id=_review_id AND program_id=p.id FOR UPDATE;
 IF NOT FOUND OR r.is_demo IS DISTINCT FROM p.is_demo THEN RAISE EXCEPTION 'This reviewed opportunity changed.'; END IF;
 IF r.ticket_id IS NULL THEN
  IF _revision IS NOT NULL THEN RAISE EXCEPTION 'This opportunity has no Ticket update.'; END IF;
  RETURN NULL;
 END IF;
 PERFORM 1 FROM public.tickets t
 JOIN public.properties h ON h.id=t.property_id AND h.id=r.property_id AND h.owner_record_id=p.owner_record_id AND h.is_demo=false
 JOIN public.property_owners o ON o.id=h.owner_record_id AND o.active
 JOIN public.owner_program_properties e ON e.property_id=h.id AND e.program_id=p.id AND e.inclusion_status='included'
 WHERE t.id=r.ticket_id AND t.is_demo=false FOR SHARE OF t,h,o,e;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Ticket Property is no longer included for this Owner.'; END IF;
 -- NULL explicitly means no reviewed narrative was displayed; do not invent a latest revision.
 IF _revision IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO u FROM public.ticket_owner_updates WHERE ticket_id=r.ticket_id AND property_id=r.property_id
  AND owner_record_id=p.owner_record_id AND revision=_revision AND is_demo=false;
 IF NOT FOUND THEN RAISE EXCEPTION 'The reviewed Ticket revision is not available.'; END IF;
 RETURN jsonb_build_object('revision',u.revision,'issue',u.issue,'work_performed',u.work_performed,'outcome',u.outcome,'reviewed_at',u.reviewed_at);
END $$;
REVOKE ALL ON FUNCTION public.read_owner_review_update(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_review_update(uuid,integer) TO authenticated,service_role;

-- Replace the old signature so there is only one response endpoint.
DROP FUNCTION public.respond_owner_review(uuid,timestamptz,text,text);
CREATE FUNCTION public.respond_owner_review(_review_id uuid,_expected_updated_at timestamptz,_decision text,_response text,_owner_update_revision integer)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE review public.owner_reviews; program public.owner_programs; snapshot jsonb;
BEGIN
 -- Scope validation locks program then review before any response write.
 snapshot:=public.read_owner_review_update(_review_id,_owner_update_revision);
 SELECT p.* INTO program FROM public.owner_programs p JOIN public.owner_reviews r ON r.program_id=p.id WHERE r.id=_review_id;
 IF NOT FOUND OR auth.uid() IS NULL OR program.owner_user_id IS DISTINCT FROM auth.uid() OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed') THEN
  RAISE EXCEPTION 'This participation program is not available for your response.';
 END IF;
 SELECT * INTO review FROM public.owner_reviews WHERE id=_review_id AND program_id=program.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This opportunity is not available.'; END IF;
 IF _expected_updated_at IS NULL OR review.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'The opportunity changed. Refresh before responding.'; END IF;
 IF review.status NOT IN ('awaiting_owner','returned') OR review.available_from>now() THEN RAISE EXCEPTION 'This opportunity is not currently awaiting your response.'; END IF;
 IF length(trim(coalesce(_decision,''))) NOT BETWEEN 1 AND 60 OR length(coalesce(_response,''))>2000 THEN RAISE EXCEPTION 'Enter a valid response.'; END IF;
 IF review.auto_ticket AND _decision<>'acknowledged' THEN RAISE EXCEPTION 'Use the canonical approval request; this response records participation only.'; END IF;

 UPDATE public.owner_reviews SET owner_decision=_decision,owner_response=nullif(_response,''),
  status=CASE WHEN auto_ticket THEN status ELSE 'answered' END,responded_at=now(),updated_at=clock_timestamp() WHERE id=review.id;
 INSERT INTO public.owner_program_events(program_id,review_id,kind,summary,actor_id,previous_value,new_value,detail)
 VALUES(review.program_id,review.id,CASE WHEN review.auto_ticket THEN 'owner_participation_response' ELSE 'owner_decision' END,
  CASE WHEN review.auto_ticket THEN 'Participation response recorded for property work; no repair approval granted.' ELSE 'Owner response recorded for participation opportunity.' END,
  auth.uid(),review.owner_decision,_decision,jsonb_build_object('previousResponse',review.owner_response,'response',nullif(_response,''),'ownerUpdate',snapshot));
 RETURN review.id;
END $$;
REVOKE ALL ON FUNCTION public.respond_owner_review(uuid,timestamptz,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_owner_review(uuid,timestamptz,text,text,integer) TO authenticated,service_role;

-- Preserve response receipts even if a role has broader event-table privileges.
CREATE FUNCTION public.preserve_owner_response_update() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.kind IN ('owner_participation_response','owner_decision') THEN
  IF NOT EXISTS(SELECT 1 FROM public.owner_reviews WHERE id=NEW.review_id AND program_id=NEW.program_id) THEN RAISE EXCEPTION 'The response history must match its opportunity.'; END IF;
  NEW.detail:=coalesce(NEW.detail,'{}'::jsonb) || jsonb_build_object('ownerUpdate',public.read_owner_review_update(NEW.review_id,(NEW.detail->'ownerUpdate'->>'revision')::integer));
  RETURN NEW;
 END IF;
 IF TG_OP IN ('UPDATE','DELETE') AND OLD.kind IN ('owner_participation_response','owner_decision') THEN
  RAISE EXCEPTION 'Participation response history is immutable.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preserve_owner_response_update() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_owner_response_update BEFORE INSERT OR UPDATE OR DELETE ON public.owner_program_events
 FOR EACH ROW EXECUTE FUNCTION public.preserve_owner_response_update();
