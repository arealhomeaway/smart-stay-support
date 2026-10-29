CREATE OR REPLACE FUNCTION private.str_report_refs(_built jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce(jsonb_agg(r->'internal'), '[]'::jsonb) FROM jsonb_array_elements(_built->'rows') r
$function$
