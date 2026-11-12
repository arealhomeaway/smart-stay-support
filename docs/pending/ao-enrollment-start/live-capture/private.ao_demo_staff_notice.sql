CREATE OR REPLACE FUNCTION private.ao_demo_staff_notice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(NEW.is_demo, false) AND NEW.kind IN ('owner_item_message', 'ao_card_expired') THEN
    NEW.email_status := 'skipped';
    NEW.email_error := coalesce(NEW.email_error, 'Demo notification: external delivery blocked.');
  END IF;
  RETURN NEW;
END $function$
;

