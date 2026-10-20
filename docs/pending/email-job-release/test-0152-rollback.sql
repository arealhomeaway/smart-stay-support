-- PREPARED ONLY. Requires a privileged transaction-capable runner, stop on error and always rollback/disconnect. Never run through migration tooling.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
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
DO $checks$
DECLARE staff text; owner_address text; rid uuid; result boolean; test_case record;
BEGIN
 SELECT email INTO staff FROM public.profiles WHERE id='ea6708cd-7f53-4b36-bec8-f5b2a597e6db';
 SELECT coalesce(u.email,p.owner_email) INTO owner_address FROM public.owner_programs p LEFT JOIN auth.users u ON u.id=p.owner_user_id WHERE p.id='579cb6ae-c5a5-4aa3-aac2-64eedd2faafe';
 IF staff IS NULL OR owner_address IS NULL THEN RAISE EXCEPTION 'Required real recipient unavailable'; END IF;
 FOR test_case IN SELECT * FROM (VALUES
  ('a',staff,NULL::text,NULL::uuid,true),
  ('b',owner_address,'owner_program','579cb6ae-c5a5-4aa3-aac2-64eedd2faafe'::uuid,true),
  ('c',staff,'owner_program','d9bfe859-672e-4909-987a-cd66d3dc5301'::uuid,false),
  ('d','blocked@resolve-test.invalid',NULL,NULL,false),
  ('e-ticket',staff,'ticket','35999360-5b73-439b-982d-6fddd80eac43'::uuid,true),
  ('e-staff_notification',staff,'staff_notification','5d8735bc-947e-4fc7-bb5a-934b8fe55c58'::uuid,true),
  ('e-owner_notification',staff,'owner_notification','618a5ff8-9059-4fdf-8d77-4cd8d69fb232'::uuid,true),
  ('e-work_item',staff,'work_item','63f0d8cb-cfef-4124-83cd-cca90f9333b2'::uuid,true)
 ) AS cases(label,recipient,entity,entity_id,expected) LOOP
  result := public.email_delivery_allowed(ARRAY[test_case.recipient],test_case.entity,test_case.entity_id);
  IF result IS DISTINCT FROM test_case.expected THEN RAISE EXCEPTION 'Case %: actual %, expected %',test_case.label,result,test_case.expected; END IF;
  RAISE NOTICE 'Case %: %',test_case.label,result;
 END LOOP;
END $checks$;

ROLLBACK;
