CREATE OR REPLACE FUNCTION private.ao_home_stage(_property uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce((
    SELECT CASE
      WHEN p.handoff_state = 'accepted' OR p.ops_accepted_at IS NOT NULL OR p.completed_at IS NOT NULL THEN 'operations'
      WHEN p.handoff_state = 'ready' OR p.ready_for_ops_at IS NOT NULL
        OR (p.planned_closing_on IS NOT NULL AND p.planned_closing_on <= (now() AT TIME ZONE 'America/Chicago')::date) THEN 'onboarding_launch'
      ELSE 'onboarding_early' END
    FROM public.onboarding_projects p WHERE p.property_id = _property
    ORDER BY p.created_at DESC LIMIT 1), 'operations')
$function$
;

