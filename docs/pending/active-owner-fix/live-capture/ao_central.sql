CREATE OR REPLACE FUNCTION private.ao_central(_d date, _hh integer)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$ SELECT ((_d::timestamp + make_interval(hours => _hh)) AT TIME ZONE 'America/Chicago') $function$
;
