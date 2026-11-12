-- The definition before the Nov 12 live change (audit_log breezeway_guard_onboarding_untied, before_value.def).
-- Same body as drizzle/migrations/0323_breezeway_bridge.sql section 7. Restoring it is the undo.
CREATE OR REPLACE FUNCTION private.refuse_internal_work_orders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'internal_work_orders'), false) THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'work_orders' THEN
    IF coalesce(NEW.is_demo, false) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Work orders are made in Breezeway for now. Link the Breezeway work order on the ticket.'
      USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'Nothing is sent to Breezeway from Resolve for now. Make the task in Breezeway.'
    USING ERRCODE = '42501';
END $function$;
