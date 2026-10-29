CREATE OR REPLACE FUNCTION public.str_report_context(_property uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_director(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'property', (SELECT jsonb_build_object('id',id,'name',public.format_property_label(to_jsonb(properties))->>'primary') FROM public.properties WHERE id=_property),
    'tracking', (SELECT jsonb_build_object('from',tracking_from,'active',active) FROM public.cleaner_hours_properties WHERE property_id=_property),
    'programs', coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'ownerName',o.owner_name,'status',o.status,
                  'periodStart',(private.str_program_period(o.id)).period_start,'periodEnd',(private.str_program_period(o.id)).period_end)
                  ORDER BY o.started_on DESC NULLS LAST)
                FROM public.owner_programs o
                WHERE o.archived_at IS NULL AND EXISTS (SELECT 1 FROM public.owner_program_properties pp
                  WHERE pp.program_id=o.id AND pp.property_id=_property AND pp.inclusion_status='included')), '[]'::jsonb),
    'versions', coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'programId',r.program_id,'version',r.version,'status',r.status,
                  'periodStart',r.period_start,'periodEnd',r.period_end,'generatedAt',r.generated_at,'releasedAt',r.released_at,
                  'supersededAt',r.superseded_at,'revisionReason',r.revision_reason,'exclusionNote',r.exclusion_note,
                  'blockers',r.blockers,'totals',r.snapshot->'totals') ORDER BY r.version DESC)
                FROM public.str_participation_reports r WHERE r.property_id=_property), '[]'::jsonb),
    'sources', (SELECT jsonb_agg(jsonb_build_object('label',label,'active',active,'category',activity_category) ORDER BY active DESC, label)
                FROM public.property_work_sources)
  );
END $function$
;