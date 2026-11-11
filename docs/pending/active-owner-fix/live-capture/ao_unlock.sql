CREATE OR REPLACE FUNCTION private.ao_unlock(_plan_card uuid, _actor uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pc public.ao_home_plan_cards; c public.ao_library_cards; start_d date; dl date; flex boolean;
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR pc.join_outcome <> 'locked' OR pc.unlocked_at IS NOT NULL THEN RETURN false; END IF;
  SELECT * INTO c FROM public.ao_library_cards WHERE id = pc.card_id;
  start_d := (now() AT TIME ZONE 'America/Chicago')::date;
  flex := c.lane = 'flexible' OR c.cutoff_rule = 'none';
  dl := CASE WHEN c.deadline_business_days IS NOT NULL THEN private.ao_add_business_days(start_d, c.deadline_business_days)
             WHEN c.deadline_calendar_days IS NOT NULL THEN start_d + c.deadline_calendar_days END;
  UPDATE public.ao_home_plan_cards SET unlocked_at = now(), unlocked_by = _actor,
    deadline_at = CASE WHEN dl IS NOT NULL THEN private.ao_central(dl, 17) END,
    reminder_at = CASE WHEN dl IS NOT NULL AND NOT flex THEN private.ao_central(private.ao_add_business_days(dl, -1), 17) END,
    cutoff_at = CASE WHEN dl IS NOT NULL AND NOT flex THEN private.ao_central(private.ao_add_business_days(dl, greatest(1, c.cutoff_business_days)), 9) END
  WHERE id = pc.id;
  UPDATE public.owner_reviews SET status = 'awaiting_owner', available_from = now(), respond_by = dl,
    recommendation = c.why_text, updated_at = now()
  WHERE id = pc.owner_review_id;
  RETURN true;
END $function$
;
