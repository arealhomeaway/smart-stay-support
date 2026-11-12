-- Owner Opportunities and Task Drawer, staged file 02 (approved by the Admin, Nov 11). Needs 01.
-- 1. New read public.ao_owner_portal_plan: the same rows and access rule as ao_owner_plan, plus the
--    card's stage window, its owner item and once per owner, so the Opportunities page can group
--    plan cards and never show a plan card and its owner item twice. Until applied the page falls
--    back to ao_owner_plan.
-- 2. public.ao_submit_card: answering a once per owner card completes every other open copy on the
--    owner's homes in the same program. Everything else in the function is unchanged; CREATE OR
--    REPLACE keeps its grants. Live text before: live-capture/ao_submit_card.sql.
CREATE OR REPLACE FUNCTION public.ao_owner_portal_plan(_program uuid)
 RETURNS TABLE(plan_card_id uuid, property_id uuid, code text, title text, what_text text, opens_text text, lane text, stage_window text, output_fields jsonb, join_outcome text, unlocked_at timestamp with time zone, deadline_at timestamp with time zone, expired_at timestamp with time zone, owner_completed_at timestamp with time zone, owner_review_id uuid, once_per_owner boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Same rows and the same access rule as ao_owner_plan, plus what the Opportunities page groups by.
  SELECT pc.id, pc.property_id, c.code, c.title, c.what_text, c.opens_text, c.lane, c.stage_window, c.output_fields, pc.join_outcome,
         pc.unlocked_at, pc.deadline_at, pc.expired_at, pc.owner_completed_at, pc.owner_review_id, c.once_per_owner
  FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
  JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
  WHERE pc.program_id = _program AND pc.join_outcome IN ('locked','open')
    AND auth.uid() IS NOT NULL
    AND (private.owner_current_property_for_actor(auth.uid(), pc.property_id, _program) OR public.is_internal_staff(auth.uid()))
  ORDER BY c.code
$function$;
REVOKE ALL ON FUNCTION public.ao_owner_portal_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ao_owner_portal_plan(uuid) TO authenticated, service_role;

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
  -- Once per owner (Owner Opportunities build): the same answer completes every other open copy
  -- of this card on the owner's homes in this program, each with its own contribution record.
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
END $function$;
