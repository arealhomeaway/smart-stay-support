-- UNDO for 01: restores the live definition as of Nov 12, 2026 (before this staged fix).
-- Live definition of private.refuse_internal_work_orders, copied from the database on Nov 12, 2026
-- (pg_get_functiondef). Changed on the live database by Claude, audit_log action
-- breezeway_guard_onboarding_untied (2026-11-12 16:05:19 UTC). Saved here so the repository matches.
-- Triggers using it (unchanged):
--   CREATE TRIGGER work_orders_internal_switch BEFORE INSERT ON public.work_orders
--     FOR EACH ROW EXECUTE FUNCTION private.refuse_internal_work_orders();
--   CREATE TRIGGER breezeway_outbound_internal_switch BEFORE INSERT ON public.breezeway_outbound_tasks
--     FOR EACH ROW EXECUTE FUNCTION private.refuse_internal_work_orders();
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
  -- Onboarding sends follow their own switch (approved Nov 12); tickets and work orders do not.
  IF TG_TABLE_NAME = 'breezeway_outbound_tasks' AND NEW.source_type = 'onboarding_task'
     AND coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'onboarding_breezeway_send'), false) THEN
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
