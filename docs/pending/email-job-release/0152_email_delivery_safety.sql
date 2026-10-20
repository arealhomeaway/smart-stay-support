-- NOT APPLIED. Release prerequisite: safety only, no schedule or data backfill.
CREATE OR REPLACE FUNCTION public.email_delivery_allowed(
 _recipients text[], _entity_type text DEFAULT NULL, _entity_id uuid DEFAULT NULL,
 _ticket_id uuid DEFAULT NULL, _actor_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE address text; tab text; row_data jsonb;
BEGIN
 IF cardinality(_recipients) IS NULL OR cardinality(_recipients)=0 THEN RETURN false; END IF;
 FOREACH address IN ARRAY _recipients LOOP
  IF address IS NULL OR address !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$'
    OR address ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$' THEN RETURN false; END IF;
  -- Check canonical account email, and profile aliases linked to that account.
  IF EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE lower(trim(p.email))=lower(trim(address))
      AND u.email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN RETURN false; END IF;
  -- A demo program contact is blocked even if the caller omitted record context.
  IF EXISTS (SELECT 1 FROM public.owner_programs p WHERE p.is_demo
    AND (lower(trim(p.owner_email))=lower(trim(address)) OR p.owner_user_id IN
      (SELECT id FROM auth.users WHERE lower(trim(email))=lower(trim(address))))) THEN RETURN false; END IF;
 END LOOP;
 IF _actor_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=_actor_id
   AND email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN RETURN false; END IF;
 IF _ticket_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tickets WHERE id=_ticket_id AND is_demo=false) THEN RETURN false; END IF;
 IF _entity_type IS NOT NULL THEN
  tab := CASE _entity_type
    WHEN 'owner_program' THEN 'owner_programs' WHEN 'owner_notification' THEN 'owner_notifications'
    WHEN 'staff_notification' THEN 'staff_notifications' WHEN 'ticket' THEN 'tickets'
    WHEN 'property' THEN 'properties' WHEN 'work_order' THEN 'work_orders'
    WHEN 'onboarding_task' THEN 'onboarding_tasks' WHEN 'work_item' THEN 'work_items'
    WHEN 'help_ticket' THEN 'help_tickets' WHEN 'approval' THEN 'approvals'
    WHEN 'handoff' THEN 'handoffs'
    WHEN 'claim' THEN 'claims' WHEN 'vendor_org' THEN 'vendor_orgs'
    WHEN 'onboarding_project' THEN 'onboarding_projects' WHEN 'owner_review' THEN 'owner_reviews'
    WHEN 'financial_request' THEN 'financial_requests' ELSE NULL END;
  IF tab IS NULL OR _entity_id IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',tab) INTO row_data USING _entity_id;
  IF row_data IS NULL OR coalesce((row_data->>'is_demo')::boolean,false) THEN RETURN false; END IF;
  IF row_data->>'property_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=(row_data->>'property_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF row_data->>'program_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.owner_programs WHERE id=(row_data->>'program_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF row_data->>'project_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.onboarding_projects WHERE id=(row_data->>'project_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  -- Notification source entities inherit the source's demo flag, not just their own.
  IF tab='staff_notifications' AND row_data->>'entity_id' IS NOT NULL THEN
    RETURN public.email_delivery_allowed(_recipients,
      CASE row_data->>'entity_type' WHEN 'vendor' THEN 'vendor_org' ELSE row_data->>'entity_type' END,
      (row_data->>'entity_id')::uuid,NULL,_actor_id);
  END IF;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.email_delivery_allowed(text[],text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_allowed(text[],text,uuid,uuid,uuid) TO service_role;
-- Defense at the source for every owner-notification producer, without editing existing records.
CREATE OR REPLACE FUNCTION private.block_demo_owner_notification_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.is_demo OR EXISTS(SELECT 1 FROM public.owner_programs p WHERE p.id=NEW.program_id AND p.is_demo)
   OR EXISTS(SELECT 1 FROM auth.users u WHERE u.id=NEW.owner_user_id AND
     u.email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN
   NEW.is_demo := true;
   NEW.email_status := 'skipped'; NEW.sms_status := 'skipped';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER block_demo_owner_notification_delivery BEFORE INSERT OR UPDATE ON public.owner_notifications
 FOR EACH ROW EXECUTE FUNCTION private.block_demo_owner_notification_delivery();