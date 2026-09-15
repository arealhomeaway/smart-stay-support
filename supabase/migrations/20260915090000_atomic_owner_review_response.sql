-- Unapplied. Caller RLS remains in force; response and history are one transaction.
CREATE FUNCTION public.respond_owner_review(_review_id uuid,_expected_updated_at timestamptz,_decision text,_response text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE review public.owner_reviews%ROWTYPE; program public.owner_programs%ROWTYPE;
BEGIN
 SELECT * INTO review FROM public.owner_reviews WHERE id=_review_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This opportunity is not available.'; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=review.program_id;
 IF NOT FOUND OR auth.uid() IS NULL OR program.owner_user_id IS DISTINCT FROM auth.uid() OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed') THEN
   RAISE EXCEPTION 'This participation program is not available for your response.';
 END IF;
 IF _expected_updated_at IS NULL OR review.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'The opportunity changed. Refresh before responding.'; END IF;
 IF review.status NOT IN ('awaiting_owner','returned') OR review.available_from>now() THEN RAISE EXCEPTION 'This opportunity is not currently awaiting your response.'; END IF;
 IF length(trim(coalesce(_decision,''))) NOT BETWEEN 1 AND 60 OR length(coalesce(_response,''))>2000 THEN RAISE EXCEPTION 'Enter a valid response.'; END IF;
 IF review.auto_ticket AND _decision<>'acknowledged' THEN RAISE EXCEPTION 'Use the canonical approval request; this response records participation only.'; END IF;
 UPDATE public.owner_reviews SET owner_decision=_decision,owner_response=nullif(_response,''),
   status=CASE WHEN auto_ticket THEN status ELSE 'answered' END,responded_at=now(),updated_at=clock_timestamp()
 WHERE id=review.id;
 INSERT INTO public.owner_program_events(program_id,review_id,kind,summary,actor_id,previous_value,new_value,detail)
 VALUES(review.program_id,review.id,CASE WHEN review.auto_ticket THEN 'owner_participation_response' ELSE 'owner_decision' END,
   CASE WHEN review.auto_ticket THEN 'Participation response recorded for property work; no repair approval granted.' ELSE 'Owner response recorded for participation opportunity.' END,
   auth.uid(),review.owner_decision,_decision,jsonb_build_object('previousResponse',review.owner_response,'response',nullif(_response,'')));
 RETURN review.id;
END $$;
REVOKE ALL ON FUNCTION public.respond_owner_review(uuid,timestamptz,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_owner_review(uuid,timestamptz,text,text) TO authenticated,service_role;
