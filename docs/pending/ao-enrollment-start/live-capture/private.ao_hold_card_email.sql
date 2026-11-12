CREATE OR REPLACE FUNCTION private.ao_hold_card_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email_status = 'pending' AND NEW.kind = 'review_ready' AND NEW.review_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.owner_review_id = NEW.review_id) THEN
    NEW.email_status := CASE WHEN coalesce((SELECT notify_email FROM public.owner_programs WHERE id = NEW.program_id), false)
                             THEN 'held' ELSE 'skipped' END;
  END IF;
  RETURN NEW;
END $function$
;

