CREATE OR REPLACE FUNCTION public.owner_str_reports()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'activePrograms', (SELECT count(*) FROM public.owner_programs o
        WHERE o.owner_user_id = auth.uid() AND o.archived_at IS NULL AND o.status <> 'completed'
          AND EXISTS (SELECT 1 FROM private.str_program_properties(o.id))),
    'reports', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'version', r.version, 'propertyName', p.name,
        'periodStart', r.period_start, 'periodEnd', r.period_end,
        'generatedAt', r.generated_at, 'releasedAt', r.released_at,
        'revised', r.version > 1, 'snapshot', r.snapshot) ORDER BY p.name)
      FROM public.str_participation_reports r
      JOIN public.owner_programs o ON o.id = r.program_id
      JOIN public.properties p ON p.id = r.property_id
      WHERE r.status = 'released' AND o.status = 'completed' AND o.owner_user_id = auth.uid()
        AND o.archived_at IS NULL), '[]'::jsonb))
  WHERE auth.uid() IS NOT NULL
$function$
;