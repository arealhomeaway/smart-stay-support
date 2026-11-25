CREATE OR REPLACE FUNCTION public.ao_submit_card(_plan_card uuid, _values jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pc public.ao_home_plan_cards; cid uuid; uid uuid := auth.uid(); sib public.ao_home_plan_cards;
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR uid IS NULL
     OR NOT private.owner_current_property_for_actor(uid, pc.property_id, pc.program_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF pc.unlocked_at IS NULL THEN RAISE EXCEPTION 'This item is not open yet'; END IF;
  IF pc.expired_at IS NOT NULL THEN RAISE EXCEPTION 'This item has closed'; END IF;
  IF pc.owner_completed_at IS NOT NULL THEN RAISE EXCEPTION 'Another homeowner already answered this item'; END IF;
  INSERT INTO public.ao_contributions(plan_card_id, property_id, program_id, card_id, submitted_by, field_values)
    VALUES (pc.id, pc.property_id, pc.program_id, pc.card_id, uid, coalesce(_values, '{}'::jsonb)) RETURNING id INTO cid;
  UPDATE public.ao_home_plan_cards SET owner_completed_at = now() WHERE id = pc.id;
  UPDATE public.owner_reviews SET status = 'answered', responded_at = now(), updated_at = now() WHERE id = pc.owner_review_id;
  IF EXISTS (SELECT 1 FROM public.ao_library_cards c WHERE c.id = pc.card_id AND c.once_per_owner) THEN
    FOR sib IN SELECT * FROM public.ao_home_plan_cards s
               WHERE s.program_id = pc.program_id AND s.card_id = pc.card_id AND s.id <> pc.id
                 AND s.unlocked_at IS NOT NULL AND s.expired_at IS NULL AND s.owner_completed_at IS NULL
               FOR UPDATE LOOP
      CONTINUE WHEN NOT private.owner_current_property_for_actor(uid, sib.property_id, sib.program_id);
      INSERT INTO public.ao_contributions(plan_card_id, property_id, program_id, card_id, submitted_by, field_values)
        VALUES (sib.id, sib.property_id, sib.program_id, sib.card_id, uid, coalesce(_values, '{}'::jsonb));
      UPDATE public.ao_home_plan_cards SET owner_completed_at = now() WHERE id = sib.id;
      UPDATE public.owner_reviews SET status = 'answered', responded_at = now(), updated_at = now() WHERE id = sib.owner_review_id;
    END LOOP;
  END IF;
  RETURN cid;
END $function$
;
