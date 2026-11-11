CREATE OR REPLACE FUNCTION private.ao_title_key(_t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ SELECT lower(btrim(regexp_replace(coalesce(_t,''), '\s+', ' ', 'g'))) $function$
;
