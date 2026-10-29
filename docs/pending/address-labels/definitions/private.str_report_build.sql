CREATE OR REPLACE FUNCTION private.str_report_build(_program uuid, _property uuid, _from date, _to date, _include_owner boolean DEFAULT true, _include_nonowner boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prog public.owner_programs; prop public.properties;
  rows jsonb := '[]'::jsonb; summary jsonb; blockers jsonb;
BEGIN
  SELECT * INTO prop FROM public.properties WHERE id = _property;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property not found'; END IF;
  IF _program IS NOT NULL THEN SELECT * INTO prog FROM public.owner_programs WHERE id = _program; END IF;
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN RAISE EXCEPTION 'A valid reporting period is required.'; END IF;

  IF _include_owner AND _program IS NOT NULL THEN
    rows := rows || coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'date', e.entry_date, 'person', coalesce(prog.owner_name,'Owner'), 'personKind','owner',
        'workType', CASE WHEN NOT EXISTS (SELECT 1 FROM public.owner_time_entry_properties x WHERE x.entry_id=e.id)
                         THEN 'Program-Level / Shared Participation' ELSE 'Property-Specific Owner Participation' END,
        'scope', CASE WHEN NOT EXISTS (SELECT 1 FROM public.owner_time_entry_properties x WHERE x.entry_id=e.id)
                      THEN 'program' ELSE 'property' END,
        'description', coalesce(nullif(e.activity,''),'Participation'),
        'source','Resolve owner participation',
        'reference', CASE WHEN r.title IS NOT NULL THEN 'Opportunity: '||r.title ELSE 'Owner participation entry' END
                     || CASE WHEN (SELECT count(*) FROM public.owner_time_entry_properties x WHERE x.entry_id=e.id) > 1
                             THEN ' (shared across homes; counted once)' ELSE '' END,
        'timeClass','recorded', 'minutes', e.minutes, 'status','final',
        'correction', e.amends_entry_id IS NOT NULL,
        'internal', jsonb_build_object('kind','owner_time_entry','id',e.id,'reviewId',e.review_id)
      ) ORDER BY e.entry_date, e.created_at)
      FROM public.owner_time_entries e
      LEFT JOIN public.owner_reviews r ON r.id = e.review_id
      WHERE e.program_id = _program
        AND e.entry_date BETWEEN _from AND _to
        AND (EXISTS (SELECT 1 FROM public.owner_time_entry_properties x WHERE x.entry_id=e.id AND x.property_id=_property)
             OR NOT EXISTS (SELECT 1 FROM public.owner_time_entry_properties x WHERE x.entry_id=e.id))
        AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries n WHERE n.amends_entry_id = e.id)
    ), '[]'::jsonb);
  END IF;

  IF _include_nonowner THEN
    rows := rows || coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'date') FROM (
        SELECT jsonb_build_object(
          'date', l.completion_date,
          'person', coalesce(w.display_name, l.breezeway_person_name, 'Unidentified cleaner account'),
          'personKind', CASE WHEN w.account_type = 'company'
                               OR l.attribution_method IN ('company_only_needs_review','company_account_not_counted')
                             THEN 'company' ELSE 'individual' END,
          'workType','Cleaning',
          'description', CASE WHEN l.attribution_method='manual_entry' THEN 'Off-Breezeway clean' ELSE 'Housekeeping clean' END,
          'source', CASE WHEN l.attribution_method='manual_entry' THEN 'Resolve (manual)' ELSE 'Breezeway' END,
          'reference', CASE WHEN l.attribution_method='manual_entry' THEN 'Approved off-platform clean '||l.completion_date
                            ELSE 'Breezeway housekeeping clean '||l.completion_date END,
          'timeClass', CASE
              WHEN w.account_type = 'company' OR l.attribution_method IN ('company_only_needs_review','company_account_not_counted') THEN 'unresolved'
              WHEN l.attribution_method IN ('manual_correction','manual_entry') THEN 'manual'
              ELSE 'attributed' END,
          'minutes', CASE WHEN w.account_type = 'company' OR l.attribution_method IN ('company_only_needs_review','company_account_not_counted')
                          THEN NULL ELSE l.attributed_minutes END,
          'status', CASE WHEN w.account_type = 'company' OR l.attribution_method IN ('company_only_needs_review','company_account_not_counted') THEN 'final'
                         WHEN l.review_state = 'needs_review' OR NOT l.counted
                              OR l.attribution_method IN ('provisional_duration','provisional_cap','invalid_duration_needs_review')
                         THEN 'provisional' ELSE 'final' END,
          'correction', l.supersedes_id IS NOT NULL OR l.attribution_method = 'manual_correction',
          'internal', jsonb_build_object('kind','cleaner_ledger','id',l.id,'breezewayTaskId',l.breezeway_task_id,'workerId',l.worker_id)
        ) x
        FROM public.cleaner_exposure_ledger l
        LEFT JOIN public.cleaner_workers w ON w.id = l.worker_id
        WHERE l.property_id = _property AND l.superseded_at IS NULL
          AND l.completion_date BETWEEN _from AND _to
      ) s), '[]'::jsonb);

    rows := rows || coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'date') FROM (
        SELECT jsonb_build_object(
          'date', r.work_date, 'person', w.display_name,
          'personKind', CASE WHEN w.account_type='company' THEN 'company' ELSE 'individual' END,
          'workType', CASE s.activity_category WHEN 'maintenance' THEN 'Maintenance' WHEN 'inspection' THEN 'Inspection'
                        WHEN 'operations' THEN CASE WHEN s.code='resolve_task' THEN 'Resolve Internal Task' ELSE 'Property Operations' END
                        WHEN 'vendor' THEN 'Vendor Service' WHEN 'field' THEN 'Field Visit'
                        ELSE CASE WHEN s.code='manual_work' THEN 'Manual / Off-Platform Work' ELSE 'Other' END END,
          'description', s.label, 'source', s.label,
          'reference', s.label||' '||r.work_date,
          'timeClass', CASE WHEN w.account_type='company' THEN 'unresolved'
                            WHEN coalesce(r.minutes,0) = 0 OR r.method = 'activity_only' THEN 'activity_only'
                            WHEN r.method IN ('manual','manual_entry','manual_correction') THEN 'manual'
                            WHEN r.method IN ('attributed','attributed_elapsed') THEN 'attributed'
                            WHEN r.method IN ('recorded','source_duration','clocked') THEN 'recorded'
                            ELSE 'activity_only' END,
          'minutes', CASE WHEN w.account_type='company' OR coalesce(r.minutes,0)=0
                            OR r.method NOT IN ('manual','manual_entry','manual_correction','attributed','attributed_elapsed','recorded','source_duration','clocked')
                          THEN NULL ELSE r.minutes END,
          'status', CASE WHEN r.review_state='needs_review' THEN 'provisional' ELSE 'final' END,
          'correction', r.supersedes_id IS NOT NULL,
          'internal', jsonb_build_object('kind','work_record','id',r.id,'sourceRef',r.source_ref,'personId',r.person_id)
        ) x
        FROM public.property_work_records r
        JOIN public.property_work_sources s ON s.code = r.source_code
        JOIN public.cleaner_workers w ON w.id = r.person_id
        WHERE r.property_id = _property AND r.superseded_at IS NULL
          AND r.work_date BETWEEN _from AND _to
          AND NOT s.counts_toward_cleaner_safeguard
      ) s), '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(g ORDER BY g->>'sortBucket', (g->>'sortMinutes')::numeric DESC, g->>'person'), '[]'::jsonb)
    INTO summary FROM (
    SELECT jsonb_build_object(
      'person', r->>'person', 'personKind', r->>'personKind', 'workType', r->>'workType',
      'source', string_agg(DISTINCT r->>'source', ', '),
      'timeClass', r->>'timeClass',
      'activities', count(*) FILTER (WHERE r->>'status'='final'),
      'underReview', count(*) FILTER (WHERE r->>'status'='provisional'),
      'minutes', CASE WHEN r->>'timeClass' IN ('activity_only','unresolved') THEN NULL
                      ELSE coalesce(sum((r->>'minutes')::numeric) FILTER (WHERE r->>'status'='final'),0) END,
      'sortBucket', CASE WHEN r->>'personKind'='owner' THEN '1'
                         WHEN r->>'timeClass'='unresolved' THEN '4'
                         WHEN r->>'timeClass'='activity_only' THEN '3' ELSE '2' END,
      'sortMinutes', coalesce(sum((r->>'minutes')::numeric) FILTER (WHERE r->>'status'='final'),0)
    ) g
    FROM jsonb_array_elements(rows) r
    GROUP BY r->>'person', r->>'personKind', r->>'workType', r->>'timeClass'
  ) q;

  SELECT coalesce(jsonb_agg(jsonb_build_object('date', r->>'date', 'person', r->>'person',
           'workType', r->>'workType', 'reference', r->>'reference', 'internal', r->'internal')), '[]'::jsonb)
    INTO blockers FROM jsonb_array_elements(rows) r WHERE r->>'status'='provisional';

  RETURN jsonb_build_object(
    'property', jsonb_build_object('name', public.format_property_label(to_jsonb(prop))->>'primary', 'address', public.format_property_label(to_jsonb(prop))->>'full'),
    'owner', jsonb_build_object('name', coalesce(prog.owner_name,'Owner')),
    'program', jsonb_build_object('startedOn', prog.started_on, 'endsOn', (private.str_program_period(_program)).period_end,
                                  'status', prog.status),
    'period', jsonb_build_object('from', _from, 'to', _to),
    'include', jsonb_build_object('owner', _include_owner, 'nonOwner', _include_nonowner),
    'rows', rows, 'summary', summary,
    'totals', jsonb_build_object(
      'ownerMinutes', coalesce((SELECT sum((r->>'minutes')::numeric) FROM jsonb_array_elements(rows) r
                                 WHERE r->>'personKind'='owner' AND r->>'status'='final' AND r->>'scope'='property'),0),
      'ownerProgramLevelMinutes', coalesce((SELECT sum((r->>'minutes')::numeric) FROM jsonb_array_elements(rows) r
                                 WHERE r->>'personKind'='owner' AND r->>'scope'='program'),0),
      'ownerProgramTotalMinutes', CASE WHEN _program IS NULL OR NOT _include_owner THEN 0 ELSE coalesce((
          SELECT sum(e.minutes) FROM public.owner_time_entries e
          WHERE e.program_id=_program AND e.entry_date BETWEEN _from AND _to
            AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries n WHERE n.amends_entry_id=e.id)),0) END,
      'ownerEntries', (SELECT count(*) FROM jsonb_array_elements(rows) r WHERE r->>'personKind'='owner'),
      'nonOwnerSupportedMinutes', coalesce((SELECT sum((r->>'minutes')::numeric) FROM jsonb_array_elements(rows) r
                                 WHERE r->>'personKind'='individual' AND r->>'status'='final' AND r->>'minutes' IS NOT NULL),0),
      'underReview', jsonb_array_length(blockers)),
    'blockers', blockers,
    'programLevelNote', 'Program-Level Participation is owner participation not linked to a specific property. It is not automatically assigned to any property and is shown separately to avoid double-counting.',
    'disclaimer', 'This report summarizes operational participation and work activity recorded in Resolve and connected systems. Attributed time may be based on operational estimates where individual clock-in/clock-out data is unavailable. This report is provided for recordkeeping and operational support only and does not constitute tax, legal, or accounting advice or a determination of tax eligibility.'
  );
END $function$
;