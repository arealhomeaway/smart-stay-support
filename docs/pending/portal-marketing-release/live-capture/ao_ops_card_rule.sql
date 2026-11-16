CREATE OR REPLACE FUNCTION private.ao_ops_card_rule(_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN _code IN ('A33', 'N10') THEN 'stays_locked'
              WHEN _code IN ('A14', 'A35') THEN 'waits_for_bridge' END
$function$

