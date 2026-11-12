CREATE OR REPLACE FUNCTION private.block_demo_owner_notification_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF NEW.is_demo OR EXISTS(SELECT 1 FROM public.owner_programs p WHERE p.id=NEW.program_id AND p.is_demo)
   OR EXISTS(SELECT 1 FROM auth.users u WHERE u.id=NEW.owner_user_id AND
     u.email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN
   NEW.is_demo := true;
   NEW.email_status := 'skipped'; NEW.sms_status := 'skipped';
 END IF;
 RETURN NEW;
END $function$
;

