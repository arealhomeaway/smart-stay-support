-- APPLIED Oct 20 as 0154_block_demo_owner_notification_delivery. Do not re-apply. Function part applied as 0151_0152_email_delivery_allowed_function.
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