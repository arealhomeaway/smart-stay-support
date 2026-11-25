CREATE OR REPLACE FUNCTION public.respond_owner_review(_review_id uuid, _expected_updated_at timestamp with time zone, _decision text, _response text, _owner_update_revision integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE review public.owner_reviews; program public.owner_programs; snapshot jsonb;
BEGIN
 -- Scope validation locks program then review before any response write.
 snapshot:=public.read_owner_review_update(_review_id,_owner_update_revision);
 SELECT p.* INTO program FROM public.owner_programs p JOIN public.owner_reviews r ON r.program_id=p.id WHERE r.id=_review_id;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT coalesce(private.is_program_member(program.id,auth.uid()),false) OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed') THEN
  RAISE EXCEPTION 'This participation program is not available for your response.';
 END IF;
 SELECT * INTO review FROM public.owner_reviews WHERE id=_review_id AND program_id=program.id FOR UPDATE NOWAIT;
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
  auth.uid(),review.owner_decision,_decision,jsonb_build_object('previousResponse',review.owner_response,'response',nullif(_response,''),'ownerUpdate',snapshot,'propertyId',review.property_id,'ticketId',review.ticket_id));
 RETURN review.id;
END $function$
;
