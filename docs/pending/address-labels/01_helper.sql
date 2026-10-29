CREATE OR REPLACE FUNCTION public.format_property_label(_property jsonb)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $function$
 WITH parts AS (
  SELECT coalesce(btrim(_property->>'address_line1'),'') street,
   coalesce(btrim(_property->>'unit'),'') unit,
   coalesce(nullif(btrim(_property->>'name'),''),'Home') listing,
   coalesce(btrim(_property->>'city'),'') city,
   coalesce(btrim(_property->>'state'),'') state,
   coalesce(btrim(_property->>'postal_code'),'') zip
 ), labels AS (
  SELECT CASE WHEN street<>'' THEN street || CASE WHEN unit='' THEN '' ELSE ', ' || CASE WHEN unit ~* '^unit\y' THEN unit ELSE 'Unit ' || unit END END
   ELSE listing || ' (address missing)' END primary_label,
   concat_ws(', ',nullif(city,''),nullif(state,'')) secondary_label,
   city,concat_ws(' ',nullif(state,''),nullif(zip,'')) region FROM parts
 ) SELECT jsonb_build_object('primary',primary_label,'secondary',secondary_label,
  'full',concat_ws(', ',primary_label,nullif(city,''),nullif(region,''))) FROM labels
$function$;
REVOKE ALL ON FUNCTION public.format_property_label(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.format_property_label(jsonb) TO authenticated, service_role;
