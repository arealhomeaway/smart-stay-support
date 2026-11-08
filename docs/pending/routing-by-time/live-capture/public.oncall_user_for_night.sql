CREATE OR REPLACE FUNCTION public.oncall_user_for_night(_night date)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT r.user_id FROM public.oncall_roster r
      WHERE _night BETWEEN r.starts_on AND r.ends_on
      ORDER BY (r.ends_on - r.starts_on), r.created_at DESC
      LIMIT 1),
    (SELECT NULLIF(s.value ->> EXTRACT(dow FROM _night)::int::text, '')::uuid
      FROM public.app_settings s WHERE s.key = 'oncall_weekday_pattern')
  )
$function$

