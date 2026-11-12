-- STAGED, NOT APPLIED. Needs approval before it runs.
-- Fixes the live guard (audit_log breezeway_guard_onboarding_untied, Nov 12): its onboarding check reads
-- NEW.source_type in the same condition as TG_TABLE_NAME, so on public.work_orders (no source_type column)
-- every insert now stops with 'record "new" has no field "source_type"', including demo practice rows that
-- were allowed before. The onboarding check moves inside a breezeway_outbound_tasks block. Same rules otherwise:
-- onboarding sends pass while onboarding_breezeway_send is on; tickets and Resolve work orders unchanged.
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
  IF TG_TABLE_NAME = 'breezeway_outbound_tasks' THEN
    IF NEW.source_type = 'onboarding_task'
       AND coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'onboarding_breezeway_send'), false) THEN
      RETURN NEW;
    END IF;
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
