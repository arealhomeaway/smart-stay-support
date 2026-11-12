CREATE OR REPLACE FUNCTION private.ao_digest_time()
 RETURNS time without time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce((SELECT (value ->> 'time')::time FROM public.app_settings WHERE key = 'owner_digest_time'), time '09:00')
$function$
;

