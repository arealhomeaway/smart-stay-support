CREATE OR REPLACE FUNCTION private.block_owner_message_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN RAISE EXCEPTION 'Conversation messages are permanent history and cannot be changed or removed.'; END $function$
;
