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
    AND (private.owner_current_property_for_actor(auth.uid(), pc.property_id, _program) OR public.is_internal_staff(auth.uid()))
  ORDER BY c.code
$function$

