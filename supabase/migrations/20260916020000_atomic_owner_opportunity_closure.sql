-- Staff withdrawal and its history are one transaction. Program-before-review
-- locking matches owner responses and prevents closeout/report-version races.
CREATE FUNCTION public.close_owner_opportunity(
 _review_id uuid,_expected_updated_at timestamptz,_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE review public.owner_reviews; program public.owner_programs;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_internal_staff(auth.uid()),false) THEN
  RAISE EXCEPTION 'Only staff may close participation opportunities.';
 END IF;
 IF length(trim(coalesce(_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Explain why this participation opportunity is being withdrawn.';
 END IF;
 SELECT p.* INTO program FROM public.owner_programs p
 JOIN public.owner_reviews r ON r.program_id=p.id WHERE r.id=_review_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'This opportunity is not available.'; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=program.id FOR UPDATE NOWAIT;
 IF NOT FOUND OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed') THEN
  RAISE EXCEPTION 'This participation program is no longer open for changes.';
 END IF;
 SELECT * INTO review FROM public.owner_reviews WHERE id=_review_id AND program_id=program.id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_updated_at IS NULL OR review.updated_at IS DISTINCT FROM _expected_updated_at THEN
  RAISE EXCEPTION 'The opportunity changed. Refresh before closing it.';
 END IF;
 IF review.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'This opportunity does not match its program.'; END IF;
 IF review.auto_ticket OR review.ticket_id IS NOT NULL THEN
  RAISE EXCEPTION 'Ticket opportunities stay available for owner review and participation; they cannot be withdrawn manually.';
 END IF;
 IF review.status='answered' OR review.responded_at IS NOT NULL THEN
  RAISE EXCEPTION 'This opportunity already has an owner response and stays in the owner''s record.';
 END IF;
 IF review.status='closed' THEN RAISE EXCEPTION 'This opportunity is already closed.'; END IF;
 UPDATE public.owner_reviews SET status='closed',closed_at=now(),updated_at=clock_timestamp() WHERE id=review.id;
 INSERT INTO public.owner_program_events(program_id,property_id,review_id,kind,summary,actor_id,reason,previous_value,new_value)
 VALUES(program.id,review.property_id,review.id,'opportunity_closed','Participation opportunity withdrawn by staff.',
  auth.uid(),trim(_reason),review.status,'closed');
 RETURN review.id;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This opportunity is being updated. Refresh and try closing it again.';
END $$;
REVOKE ALL ON FUNCTION public.close_owner_opportunity(uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_owner_opportunity(uuid,timestamptz,text) TO authenticated,service_role;
