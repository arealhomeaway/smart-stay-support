CREATE TABLE public.str_participation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('pending_review','released','superseded')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  snapshot jsonb NOT NULL,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusion_note text,
  revision_reason text,
  supersedes_id uuid REFERENCES public.str_participation_reports(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid,
  superseded_at timestamptz,
  created_by uuid,
  UNIQUE (program_id, property_id, version)
);
GRANT SELECT ON public.str_participation_reports TO authenticated;
GRANT ALL ON public.str_participation_reports TO service_role;
ALTER TABLE public.str_participation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and Director read STR reports" ON public.str_participation_reports
  FOR SELECT TO authenticated USING (public.is_director(auth.uid()));

CREATE OR REPLACE FUNCTION private.str_report_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'STR participation reports are permanent.'; END IF;
  IF OLD.status = 'superseded' THEN RAISE EXCEPTION 'A superseded report version cannot change.'; END IF;
  IF OLD.status = 'released' THEN
    IF NEW.status <> 'superseded' OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
       OR NEW.source_refs IS DISTINCT FROM OLD.source_refs THEN
      RAISE EXCEPTION 'A released report version is frozen; create a new version instead.';
    END IF;
  END IF;
  IF NEW.program_id <> OLD.program_id OR NEW.property_id <> OLD.property_id OR NEW.version <> OLD.version
     OR NEW.period_start <> OLD.period_start OR NEW.period_end <> OLD.period_end THEN
    RAISE EXCEPTION 'Report identity and period are locked.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER str_report_guard BEFORE UPDATE OR DELETE ON public.str_participation_reports
  FOR EACH ROW EXECUTE FUNCTION private.str_report_guard();

CREATE OR REPLACE FUNCTION private.str_program_period(_program uuid, OUT period_start date, OUT period_end date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT started_on,
         CASE WHEN started_on IS NULL THEN NULL
              ELSE LEAST(coalesce(ends_on, make_date(extract(year FROM started_on)::int,12,31)),
                         make_date(extract(year FROM started_on)::int,12,31)) END
  FROM public.owner_programs WHERE id = _program
$$;

CREATE OR REPLACE FUNCTION private.str_report_build(
  _program uuid, _property uuid, _from date, _to date,
  _include_owner boolean DEFAULT true, _include_nonowner boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
        'workType','Owner Participation',
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
        AND EXISTS (SELECT 1 FROM public.owner_time_entry_properties x WHERE x.entry_id=e.id AND x.property_id=_property)
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
    'property', jsonb_build_object('name', prop.name, 'address', coalesce(prop.formatted_address, prop.address_line1)),
    'owner', jsonb_build_object('name', coalesce(prog.owner_name,'Owner')),
    'program', jsonb_build_object('startedOn', prog.started_on, 'endsOn', (private.str_program_period(_program)).period_end,
                                  'status', prog.status),
    'period', jsonb_build_object('from', _from, 'to', _to),
    'include', jsonb_build_object('owner', _include_owner, 'nonOwner', _include_nonowner),
    'rows', rows, 'summary', summary,
    'totals', jsonb_build_object(
      'ownerMinutes', coalesce((SELECT sum((r->>'minutes')::numeric) FROM jsonb_array_elements(rows) r
                                 WHERE r->>'personKind'='owner' AND r->>'status'='final'),0),
      'ownerEntries', (SELECT count(*) FROM jsonb_array_elements(rows) r WHERE r->>'personKind'='owner'),
      'nonOwnerSupportedMinutes', coalesce((SELECT sum((r->>'minutes')::numeric) FROM jsonb_array_elements(rows) r
                                 WHERE r->>'personKind'='individual' AND r->>'status'='final' AND r->>'minutes' IS NOT NULL),0),
      'underReview', jsonb_array_length(blockers)),
    'blockers', blockers,
    'disclaimer', 'This report summarizes operational participation and work activity recorded in Resolve and connected systems. Attributed time may be based on operational estimates where individual clock-in/clock-out data is unavailable. This report is provided for recordkeeping and operational support only and does not constitute tax, legal, or accounting advice or a determination of tax eligibility.'
  );
END $$;

CREATE OR REPLACE FUNCTION private.str_report_owner_safe(_built jsonb, _excluded boolean)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT (_built - 'blockers' - 'rows')
    || jsonb_build_object('rows', coalesce((SELECT jsonb_agg(r - 'internal') FROM jsonb_array_elements(_built->'rows') r), '[]'::jsonb))
    || CASE WHEN _excluded OR (_built->'totals'->>'underReview')::int > 0
            THEN jsonb_build_object('underReviewNote','Some operational activity records remain under review and are not included in finalized time totals.')
            ELSE '{}'::jsonb END
$$;

CREATE OR REPLACE FUNCTION private.str_report_refs(_built jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(r->'internal'), '[]'::jsonb) FROM jsonb_array_elements(_built->'rows') r
$$;

CREATE OR REPLACE FUNCTION private.str_program_properties(_program uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT pp.property_id FROM public.owner_program_properties pp
  JOIN public.cleaner_hours_properties c ON c.property_id = pp.property_id
  WHERE pp.program_id = _program AND pp.inclusion_status = 'included' AND pp.archived_at IS NULL
$$;

CREATE OR REPLACE FUNCTION private.str_report_create_version(_program uuid, _property uuid, _actor uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE per record; built jsonb; v int; rid uuid; prev uuid; st text; u uuid; pname text;
BEGIN
  SELECT * INTO per FROM private.str_program_period(_program);
  IF per.period_start IS NULL THEN RAISE EXCEPTION 'The program has no start date.'; END IF;
  built := private.str_report_build(_program, _property, per.period_start, per.period_end, true, true);
  SELECT coalesce(max(version),0)+1 INTO v FROM public.str_participation_reports WHERE program_id=_program AND property_id=_property;
  SELECT id INTO prev FROM public.str_participation_reports
   WHERE program_id=_program AND property_id=_property AND status='released';
  st := CASE WHEN jsonb_array_length(built->'blockers') = 0 THEN 'released' ELSE 'pending_review' END;
  INSERT INTO public.str_participation_reports(program_id, property_id, version, status, period_start, period_end,
    snapshot, source_refs, blockers, revision_reason, supersedes_id, released_at, released_by, created_by)
  VALUES (_program, _property, v, st, per.period_start, per.period_end,
    private.str_report_owner_safe(built || jsonb_build_object('version', v), false),
    private.str_report_refs(built), built->'blockers', _reason, prev,
    CASE WHEN st='released' THEN now() END, CASE WHEN st='released' THEN _actor END, _actor)
  RETURNING id INTO rid;
  IF st = 'released' AND prev IS NOT NULL THEN
    UPDATE public.str_participation_reports SET status='superseded', superseded_at=now() WHERE id=prev;
  END IF;
  IF st = 'pending_review' THEN
    SELECT name INTO pname FROM public.properties WHERE id=_property;
    FOR u IN SELECT * FROM private.cleaner_leadership_ids() LOOP
      INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority)
      VALUES (u, 'str_report_review', format('STR report v%s for %s needs review before release', v, pname),
        format('%s activity record(s) are under review. Resolve or intentionally exclude them to release the owner report.',
               jsonb_array_length(built->'blockers')),
        'property', _property, '/str-participation-report?property='||_property, 'normal');
    END LOOP;
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION private.str_report_on_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    FOR pid IN SELECT * FROM private.str_program_properties(NEW.id) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.str_participation_reports WHERE program_id=NEW.id AND property_id=pid) THEN
        PERFORM private.str_report_create_version(NEW.id, pid, NEW.completed_by, 'Program completed');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER str_report_on_completion AFTER UPDATE OF status ON public.owner_programs
  FOR EACH ROW EXECUTE FUNCTION private.str_report_on_completion();

CREATE OR REPLACE FUNCTION public.str_report_context(_property uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_director(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'property', (SELECT jsonb_build_object('id',id,'name',name) FROM public.properties WHERE id=_property),
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
END $$;

CREATE OR REPLACE FUNCTION public.str_report_preview(_property uuid, _program uuid, _from date, _to date,
  _include_owner boolean, _include_nonowner boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE st text;
BEGIN
  IF NOT public.is_director(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _program IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.owner_program_properties
      WHERE program_id=_program AND property_id=_property) THEN
    RAISE EXCEPTION 'That program does not include this property.';
  END IF;
  SELECT status INTO st FROM public.owner_programs WHERE id=_program;
  RETURN private.str_report_build(_program, _property, _from, _to, _include_owner, _include_nonowner)
    || jsonb_build_object('draft', coalesce(st,'') <> 'completed');
END $$;

CREATE OR REPLACE FUNCTION public.str_report_version(_report uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.str_participation_reports;
BEGIN
  IF NOT public.is_director(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO r FROM public.str_participation_reports WHERE id=_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  RETURN r.snapshot || jsonb_build_object('version', r.version, 'status', r.status,
    'generatedAt', r.generated_at, 'releasedAt', r.released_at, 'sourceRefs', r.source_refs, 'blockers', r.blockers);
END $$;

CREATE OR REPLACE FUNCTION public.str_report_release(_report uuid, _exclusion_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.str_participation_reports; built jsonb; prev uuid; excl boolean;
BEGIN
  IF NOT public.is_director(auth.uid()) THEN RAISE EXCEPTION 'Only an Admin or the Director of Operations can release a report.'; END IF;
  SELECT * INTO r FROM public.str_participation_reports WHERE id=_report FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending_review' THEN RAISE EXCEPTION 'Only a report pending review can be released.'; END IF;
  built := private.str_report_build(r.program_id, r.property_id, r.period_start, r.period_end, true, true);
  excl := jsonb_array_length(built->'blockers') > 0;
  IF excl AND length(btrim(coalesce(_exclusion_note,''))) < 25 THEN
    RAISE EXCEPTION 'Records are still under review. Resolve them, or give a reason of at least 25 characters to exclude them from finalized totals.';
  END IF;
  SELECT id INTO prev FROM public.str_participation_reports WHERE program_id=r.program_id AND property_id=r.property_id AND status='released';
  IF prev IS NOT NULL THEN
    UPDATE public.str_participation_reports SET status='superseded', superseded_at=now() WHERE id=prev;
  END IF;
  UPDATE public.str_participation_reports SET status='released', released_at=now(), released_by=auth.uid(),
    snapshot = private.str_report_owner_safe(built || jsonb_build_object('version', r.version), excl),
    source_refs = private.str_report_refs(built), blockers = built->'blockers',
    exclusion_note = CASE WHEN excl THEN btrim(_exclusion_note) END
  WHERE id=_report;
  RETURN jsonb_build_object('released', true, 'excluded', jsonb_array_length(built->'blockers'));
END $$;

CREATE OR REPLACE FUNCTION public.str_report_revise(_program uuid, _property uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur public.str_participation_reports; built jsonb; rid uuid;
BEGIN
  IF NOT public.is_director(auth.uid()) THEN RAISE EXCEPTION 'Only an Admin or the Director of Operations can revise a report.'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 10 THEN RAISE EXCEPTION 'A revision reason of at least 10 characters is required.'; END IF;
  IF (SELECT status FROM public.owner_programs WHERE id=_program) IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Only a completed program has a final report.'; END IF;
  IF EXISTS (SELECT 1 FROM public.str_participation_reports WHERE program_id=_program AND property_id=_property AND status='pending_review') THEN
    RAISE EXCEPTION 'A version is already pending review. Release it first.'; END IF;
  SELECT * INTO cur FROM public.str_participation_reports WHERE program_id=_program AND property_id=_property AND status='released';
  IF FOUND THEN
    built := private.str_report_build(_program, _property, cur.period_start, cur.period_end, true, true);
    IF (cur.snapshot->'rows') = (private.str_report_owner_safe(built,false)->'rows')
       AND (cur.snapshot->'summary') = built->'summary' THEN
      RETURN jsonb_build_object('created', false, 'message', 'No material change since the current version.');
    END IF;
  END IF;
  rid := private.str_report_create_version(_program, _property, auth.uid(), btrim(_reason));
  RETURN jsonb_build_object('created', true, 'id', rid);
END $$;

CREATE OR REPLACE FUNCTION public.owner_str_reports()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

REVOKE ALL ON FUNCTION public.str_report_context(uuid), public.str_report_preview(uuid,uuid,date,date,boolean,boolean),
  public.str_report_version(uuid), public.str_report_release(uuid,text), public.str_report_revise(uuid,uuid,text),
  public.owner_str_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.str_report_context(uuid), public.str_report_preview(uuid,uuid,date,date,boolean,boolean),
  public.str_report_version(uuid), public.str_report_release(uuid,text), public.str_report_revise(uuid,uuid,text),
  public.owner_str_reports() TO authenticated;