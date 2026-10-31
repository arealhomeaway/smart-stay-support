-- Undo for 01_plan_card_access.sql: restores the captured live definitions byte-for-byte (see live-reference.json).
CREATE OR REPLACE FUNCTION public.ao_submit_card(_plan_card uuid, _values jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pc public.ao_home_plan_cards; cid uuid; uid uuid := auth.uid();
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR uid IS NULL OR NOT private.is_program_member(pc.program_id, uid) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF pc.unlocked_at IS NULL THEN RAISE EXCEPTION 'This item is not open yet'; END IF;
  IF pc.expired_at IS NOT NULL THEN RAISE EXCEPTION 'This item has closed'; END IF;
  IF pc.owner_completed_at IS NOT NULL THEN RAISE EXCEPTION 'Another homeowner already answered this item'; END IF;
  INSERT INTO public.ao_contributions(plan_card_id, property_id, program_id, card_id, submitted_by, field_values)
    VALUES (pc.id, pc.property_id, pc.program_id, pc.card_id, uid, coalesce(_values, '{}'::jsonb)) RETURNING id INTO cid;
  UPDATE public.ao_home_plan_cards SET owner_completed_at = now() WHERE id = pc.id;
  UPDATE public.owner_reviews SET status = 'answered', responded_at = now(), updated_at = now() WHERE id = pc.owner_review_id;
  RETURN cid;
END $function$;

CREATE OR REPLACE FUNCTION public.ao_owner_plan(_program uuid)
 RETURNS TABLE(plan_card_id uuid, property_id uuid, code text, title text, what_text text, opens_text text, lane text, output_fields jsonb, join_outcome text, unlocked_at timestamp with time zone, deadline_at timestamp with time zone, expired_at timestamp with time zone, owner_completed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pc.id, pc.property_id, c.code, c.title, c.what_text, c.opens_text, c.lane, c.output_fields, pc.join_outcome,
         pc.unlocked_at, pc.deadline_at, pc.expired_at, pc.owner_completed_at
  FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
  JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
  WHERE pc.program_id = _program AND pc.join_outcome IN ('locked','open')
    AND auth.uid() IS NOT NULL
    AND (private.is_program_member(_program, auth.uid()) OR public.is_internal_staff(auth.uid()))
  ORDER BY c.code
$function$;

ALTER POLICY ao_plan_read ON public.ao_home_plan_cards
  USING (public.is_internal_staff(auth.uid()) OR private.is_program_member(program_id, auth.uid()));
ALTER POLICY ao_contrib_read ON public.ao_contributions
  USING (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid()) OR public.is_director(auth.uid())
         OR private.is_program_member(program_id, auth.uid()));
