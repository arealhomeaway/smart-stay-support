CREATE OR REPLACE FUNCTION private.notify_onboarding_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t record; _who text; _home text;
BEGIN
  IF NEW.task_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, title, assigned_to, created_by, property_id INTO t FROM onboarding_tasks WHERE id=NEW.task_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(full_name, email, 'A teammate') INTO _who FROM profiles WHERE id=NEW.author_id;
  SELECT coalesce(nickname, name, 'the home') INTO _home FROM properties WHERE id=t.property_id;
  PERFORM private.notify_onboarding_recipients(
    ARRAY[t.assigned_to, t.created_by] || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=t.property_id), '{}'),
    NEW.author_id, 'onboarding_task_comment', coalesce(_who,'A teammate')||' commented: '||left(NEW.body, 80),
    t.title||' · '||_home, 'onboarding_task', t.id,
    '/onboarding/'||t.property_id||'?tab=work&task='||t.id, NEW.is_demo);
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION private.notify_onboarding_task_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _actor uuid := coalesce(auth.uid(), NEW.completed_by); _who text; _home text;
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    SELECT coalesce(full_name, email, 'A teammate') INTO _who FROM profiles WHERE id=_actor;
    SELECT coalesce(nickname, name, 'the home') INTO _home FROM properties WHERE id=NEW.property_id;
    PERFORM private.notify_onboarding_recipients(
      ARRAY[NEW.created_by] || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=NEW.property_id), '{}'),
      _actor, 'onboarding_task_completed', coalesce(_who,'A teammate')||' completed a Task',
      NEW.title||' · '||_home, 'onboarding_task', NEW.id,
      '/onboarding/'||NEW.property_id||'?tab=work&task='||NEW.id, NEW.is_demo);
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION private.notify_opportunity_staff(_id uuid, _verb text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; _owner text; _home text; _link text; _to uuid[] := '{}';
  t_creator uuid; t_assignee uuid; _pm uuid;
BEGIN
  SELECT * INTO w FROM work_items WHERE id=_id;
  IF w IS NULL OR w.property_id IS NULL THEN RETURN; END IF;
  IF w.source_task_id IS NOT NULL THEN
    SELECT created_by, assigned_to INTO t_creator, t_assignee FROM onboarding_tasks WHERE id=w.source_task_id;
  END IF;
  SELECT project_manager INTO _pm FROM onboarding_projects
   WHERE property_id=w.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  _to := ARRAY[_pm, t_creator, t_assignee, w.assigned_to, public.seat_holder('onboarding_director')]
      || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id=w.property_id), '{}');
  SELECT coalesce(pr.full_name, 'The homeowner') INTO _owner FROM owner_programs p LEFT JOIN profiles pr ON pr.id=p.owner_user_id WHERE p.id=w.program_id;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id=w.property_id;
  _link := '/onboarding/'||w.property_id||'?opp='||w.id;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_collaboration',
    coalesce(_owner,'The homeowner')||' '||_verb, w.title||' · '||_home, 'work_item', w.id, _link, w.is_demo);
END $function$
;

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
    'property', jsonb_build_object('name', prop.name, 'address', coalesce(prop.formatted_address, prop.address_line1)),
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

CREATE OR REPLACE FUNCTION private.str_report_create_version(_program uuid, _property uuid, _actor uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.notify_onboarding_handoff_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _home text; _demo boolean; _u uuid;
BEGIN
  IF NEW.handoff_state = 'ready' AND OLD.handoff_state IS DISTINCT FROM 'ready' THEN
    SELECT coalesce(nickname, name, address_line1, 'A home'), coalesce(is_demo, false) INTO _home, _demo
      FROM public.properties WHERE id = NEW.property_id;
    FOR _u IN
      SELECT DISTINCT v.u FROM (
        SELECT public.seat_holder('director_ops') AS u
        UNION ALL
        SELECT o.user_id FROM public.seat_override_at('director_ops', now()) o WHERE o.kind = 'cover'
      ) v WHERE v.u IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_notifications n
         WHERE n.user_id = _u AND n.kind = 'handoff_ready' AND n.entity_type = 'onboarding_project'
           AND n.entity_id = NEW.id AND n.read_at IS NULL AND n.retracted_at IS NULL
      ) THEN
        PERFORM public.notify_staff(
          _u, 'handoff_ready', 'Home ready for handoff: ' || _home,
          'Onboarding marked this home ready for Operations. Review it and accept the carry-over items.',
          'onboarding_project', NEW.id, '/property/' || NEW.property_id::text || '?tab=handoff',
          'normal', NEW.ready_for_ops_by, true, _demo
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.notify_owner_of_onboarding_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  program public.owner_programs%ROWTYPE;
BEGIN
  IF NEW.entity_type <> 'onboarding_task' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO program FROM public.owner_programs WHERE id = NEW.program_id AND archived_at IS NULL;
  IF NOT FOUND OR program.owner_user_id IS NULL OR program.owner_user_id IS DISTINCT FROM NEW.recipient_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.owner_notifications (program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, is_demo)
  VALUES (
    program.id, NEW.recipient_id, 'review_ready', 'p3',
    'New request from Your ARHA Team',
    coalesce(nullif(NEW.title,''),'A request needs your attention')||' · '||coalesce(nullif(NEW.property_name,''),'your home'),
    CASE WHEN NEW.property_id IS NOT NULL THEN '/owner?home='||NEW.property_id ELSE '/owner' END,
    CASE WHEN program.notify_email AND NOT program.is_demo THEN 'pending' ELSE 'skipped' END,
    'skipped', program.is_demo
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.owner_completions_for_review(_demo boolean, _property uuid DEFAULT NULL::uuid)
 RETURNS TABLE(work_item_id uuid, property_id uuid, property_name text, title text, owner_name text, completed_at timestamp with time zone, responsible_id uuid, responsible_name text, assignment_exception boolean, evidence_count integer, latest_feedback text, latest_feedback_at timestamp with time zone, review_status text, reviewed_at timestamp with time zone, reviewed_by_name text, latest_internal_note text, follow_up_task_id uuid, new_owner_activity boolean, source_task_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT w.* FROM work_items w
     WHERE w.kind = 'opportunity' AND w.status = 'complete' AND w.retired_at IS NULL
       AND w.is_demo = (_demo OR private.is_synthetic_account()) AND (_property IS NULL OR w.property_id = _property)
       -- Forward-only: completions before the feature start are never backfilled into the queue.
       AND w.completed_at >= coalesce((SELECT (value #>> '{}')::timestamptz FROM app_settings WHERE key = 'owner_completion_review_start'), now())
       AND (private.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()))
       AND private.onboarding_scope_ok(auth.uid(), w.property_id)
  )
  SELECT b.id, b.property_id, coalesce(pp.nickname, pp.name, pp.address_line1),
    b.title, coalesce(op.full_name, 'Homeowner'), b.completed_at,
    pm.project_manager, pmp.full_name, pm.project_manager IS NULL,
    ((SELECT count(*) FROM documents d WHERE d.work_item_id = b.id AND d.deleted_at IS NULL)
      + (SELECT count(*) FROM work_item_resources r WHERE r.work_item_id = b.id AND r.removed_at IS NULL))::int,
    coalesce(m.body, b.owner_response -> -1 ->> 'text'), coalesce(m.created_at, b.responded_at),
    coalesce(rv.status, 'needs_review'), rv.created_at, rvp.full_name, rv.internal_note, rv.follow_up_task_id,
    (rv.created_at IS NOT NULL AND (coalesce(m.created_at, b.responded_at) > rv.created_at OR b.completed_at > rv.created_at
      OR EXISTS (SELECT 1 FROM documents d WHERE d.work_item_id = b.id AND d.created_at > rv.created_at))),
    b.source_task_id
  FROM base b
  LEFT JOIN properties pp ON pp.id = b.property_id
  LEFT JOIN owner_programs prg ON prg.id = b.program_id
  LEFT JOIN profiles op ON op.id = prg.owner_user_id
  LEFT JOIN LATERAL (SELECT project_manager FROM onboarding_projects o WHERE o.property_id = b.property_id AND o.status <> 'cancelled' ORDER BY o.created_at DESC LIMIT 1) pm ON true
  LEFT JOIN profiles pmp ON pmp.id = pm.project_manager
  LEFT JOIN LATERAL (SELECT body, created_at FROM owner_request_messages x WHERE x.work_item_id = b.id AND x.author_type = 'homeowner' ORDER BY created_at DESC LIMIT 1) m ON true
  LEFT JOIN LATERAL (SELECT * FROM owner_completion_reviews r WHERE r.work_item_id = b.id ORDER BY created_at DESC LIMIT 1) rv ON true
  LEFT JOIN profiles rvp ON rvp.id = rv.actor_id
  ORDER BY (coalesce(rv.status,'needs_review') = 'reviewed'), b.completed_at DESC NULLS LAST
$function$
;

CREATE OR REPLACE FUNCTION public.owner_release_summary(_program_id uuid, _count integer, _property_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog record; names text[]; homes text; nid uuid;
BEGIN
 PERFORM set_config('resolve.owner_release_batch','off',true);
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only an Admin or Onboarding Director can release Opportunities.';
 END IF;
 IF coalesce(_count,0)<=0 THEN RETURN NULL; END IF;
 SELECT p.* INTO prog FROM owner_programs p JOIN property_owners o ON o.id=p.owner_record_id AND o.active
 WHERE p.id=_program_id AND p.status IN ('pending','active','target_reached') AND p.archived_at IS NULL AND NOT p.is_demo;
 IF NOT FOUND OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;  -- demo/test or unlinked: no alert at all
 SELECT array_agg(coalesce(nullif(trim(h.nickname),''),h.name) ORDER BY h.name) INTO names
 FROM properties h JOIN owner_program_properties e ON e.property_id=h.id AND e.program_id=prog.id AND e.inclusion_status='included'
 WHERE NOT h.is_demo AND (_property_ids IS NULL OR h.id=ANY(_property_ids));
 homes := CASE WHEN coalesce(array_length(names,1),0)=0 THEN 'your home'
               WHEN array_length(names,1)=1 THEN names[1]
               ELSE array_to_string(names[1:array_length(names,1)-1],', ')||' and '||names[array_length(names,1)] END;
 INSERT INTO owner_notifications(program_id,owner_user_id,review_id,ticket_id,kind,priority,title,body,action_path,email_status,sms_status)
 VALUES(prog.id,prog.owner_user_id,NULL,NULL,'review_batch_ready','p3','Your Active Owner activities are ready',
   format('We added %s %s to your portal for %s. Open your portal to see what''s next. You can work them anytime.',
           _count, CASE WHEN _count=1 THEN 'activity' ELSE 'activities' END, homes),
   '/owner',CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,'skipped')
 RETURNING id INTO nid;
 RETURN nid;
END $function$
;

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

CREATE OR REPLACE FUNCTION public.post_owner_request_message(_id uuid, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; _owner uuid; _staff boolean; _type text; _name text; _mid uuid; _home text;
BEGIN
  IF coalesce(trim(_body),'')='' THEN RAISE EXCEPTION 'Type a message before sending.'; END IF;
  IF length(_body) > 5000 THEN RAISE EXCEPTION 'Please keep your message under 5,000 characters.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived');
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  _staff := public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
  IF w.prog_owner IS NOT NULL AND w.prog_owner = auth.uid() AND NOT _staff THEN
    IF w.status='complete' THEN RAISE EXCEPTION 'ARHA has resolved this request. Contact your ARHA team if something else is needed.'; END IF;
    _type := 'homeowner';
    SELECT coalesce(full_name,'The homeowner') INTO _name FROM profiles WHERE id=auth.uid();
  ELSIF _staff THEN
    IF w.status='complete' THEN RAISE EXCEPTION 'Reopen this request before sending another message.'; END IF;
    IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so this cannot be sent.'; END IF;
    _type := 'staff';
    SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id=auth.uid();
  ELSE
    RAISE EXCEPTION 'This request is not available.';
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), _type, coalesce(_name, CASE WHEN _type='staff' THEN 'Your ARHA team' ELSE 'The homeowner' END), trim(_body), coalesce(w.is_demo,false))
  RETURNING id INTO _mid;
  IF _type='homeowner' THEN
    UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()) WHERE id=w.id;
    PERFORM private.notify_opportunity_staff(w.id, 'replied');
  ELSE
    SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id=w.property_id;
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3', 'New message from Your ARHA Team', w.title||' · '||_home,
      '/owner?home='||w.property_id||'&opportunity='||w.id,
      CASE WHEN coalesce(w.is_demo,false) THEN 'skipped' ELSE 'pending' END, coalesce(w.is_demo,false));
  END IF;
  RETURN _mid;
END $function$
;

CREATE OR REPLACE FUNCTION public.publish_owner_approval(_approval_id uuid, _expected_updated_at timestamp with time zone, _expected_revision integer, _expected_owner_id uuid, _expected_program_id uuid, _expected_recipient_id uuid, _title text, _detail text, _reviewed boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE request public.approvals%ROWTYPE; program public.owner_programs%ROWTYPE; revision integer; publication_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can publish a reviewed owner approval.'; END IF;
 IF _reviewed IS DISTINCT FROM true OR length(trim(coalesce(_title,''))) NOT BETWEEN 5 AND 180 OR length(trim(coalesce(_detail,''))) NOT BETWEEN 20 AND 4000 THEN
  RAISE EXCEPTION 'Write an owner-safe title and clear decision context, then confirm the privacy review.';
 END IF;
 request:=private.lock_owner_approval(_approval_id);
 SELECT * INTO program FROM public.owner_programs WHERE id=private.owner_approval_program(request);
 SELECT coalesce(max(p.revision),0) INTO revision FROM public.owner_approval_publications p WHERE approval_id=request.id;
 IF _expected_updated_at IS NULL OR request.updated_at IS DISTINCT FROM _expected_updated_at OR _expected_revision IS DISTINCT FROM revision
  OR _expected_owner_id IS DISTINCT FROM program.owner_record_id OR _expected_program_id IS DISTINCT FROM program.id
  OR _expected_recipient_id IS DISTINCT FROM request.approver_id THEN
  RAISE EXCEPTION 'The approval, recipient or published context changed. Review the current context before publishing; keep your draft.';
 END IF;
 INSERT INTO public.owner_approval_publications(approval_id,revision,approval_updated_at,program_id,owner_record_id,property_id,recipient_id,
  entity_type,entity_id,title,detail,amount,currency,property_name,due_on,reviewed_by)
 VALUES(request.id,revision+1,request.updated_at,program.id,program.owner_record_id,request.property_id,request.approver_id,
  request.entity_type,request.entity_id,trim(_title),trim(_detail),request.amount,CASE WHEN request.currency ~ '^[A-Z]{3}$' THEN request.currency ELSE 'USD' END,
  (SELECT coalesce(nickname,name) FROM public.properties WHERE id=request.property_id),request.due_on,auth.uid()) RETURNING id INTO publication_id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,after_value)
 VALUES(auth.uid(),'owner_approval_published','approval',request.id,jsonb_build_object('publication_id',publication_id,'revision',revision+1));
 RETURN publication_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The approval context is being updated. Refresh and review it before publishing.';
END $function$
;

CREATE OR REPLACE FUNCTION public.read_owner_approvals()
 RETURNS TABLE(id uuid, approval jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 WITH historical AS (
  SELECT a.id,p.approval_updated_at AS updated_at,coalesce(a.kind,'other')::text AS kind,a.entity_type::text AS entity_type,p.title,p.detail,p.amount,p.currency,r.status,r.decision_note,r.decided_at,
   p.due_on,p.property_id,p.property_name,p.reviewed_at AS created_at,p.id AS publication_id,p.revision,r.actor_id=p.recipient_id AS recorded_by_owner,false AS can_respond,NULL::text AS blocked_reason
  FROM public.owner_approval_receipts r JOIN public.owner_approval_publications p ON p.id=r.publication_id
  JOIN public.approvals a ON a.id=r.approval_id JOIN public.owner_programs program ON program.id=p.program_id
  WHERE p.recipient_id=auth.uid() AND program.owner_record_id=p.owner_record_id
   AND private.owner_program_readable(auth.uid(),program.id,false)
 ), current_requests AS (
  SELECT a.id,a.updated_at,coalesce(a.kind,'other')::text AS kind,a.entity_type::text AS entity_type,p.title,p.detail,
   a.amount,CASE WHEN a.currency ~ '^[A-Z]{3}$' THEN a.currency ELSE 'USD' END AS currency,a.status,NULL::text AS decision_note,a.decided_at,
   a.due_on,a.property_id,coalesce(h.nickname,h.name) AS property_name,a.created_at,p.id AS publication_id,p.revision,false AS recorded_by_owner,
   a.status='pending' AND coalesce(private.owner_approval_source_current(a),false) AS can_respond,
   CASE WHEN a.status='pending' AND NOT coalesce(private.owner_approval_source_current(a),false) THEN 'The operational request changed. ARHA must reconcile it before you can decide.' END AS blocked_reason
  FROM public.approvals a JOIN public.properties h ON h.id=a.property_id
  LEFT JOIN LATERAL (SELECT x.* FROM public.owner_approval_publications x WHERE x.approval_id=a.id ORDER BY x.revision DESC LIMIT 1) latest ON true
  JOIN public.owner_approval_publications p ON p.id=latest.id AND p.approval_updated_at=a.updated_at AND p.property_id=a.property_id
   AND p.recipient_id=auth.uid() AND p.program_id=private.owner_approval_program(a) AND p.owner_record_id=h.owner_record_id
   AND p.entity_type=a.entity_type AND p.entity_id=a.entity_id
  WHERE a.approver_id=auth.uid() AND private.owner_approval_program(a) IS NOT NULL
   AND a.status IN('pending','approved','declined','changes_requested','cancelled','withdrawn')
   AND NOT EXISTS(SELECT 1 FROM public.owner_approval_receipts r WHERE r.approval_id=a.id)
 ), rows AS (SELECT * FROM historical UNION ALL SELECT * FROM current_requests)
 SELECT r.id,jsonb_build_object('id',r.id,'updated_at',r.updated_at,'kind',r.kind,'entity_type',r.entity_type,'title',r.title,'detail',r.detail,'amount',r.amount,'currency',r.currency,
  'status',r.status,'decision_note',r.decision_note,'decided_at',r.decided_at,'due_on',r.due_on,'evidence_url',NULL,'property_id',r.property_id,
  'property_name',r.property_name,'active_owner',true,'created_at',r.created_at,'publication_id',r.publication_id,'revision',r.revision,
  'recorded_by_owner',r.recorded_by_owner,'can_respond',r.can_respond,'blocked_reason',r.blocked_reason)
 FROM rows r ORDER BY r.created_at DESC,r.id
$function$
;

CREATE OR REPLACE FUNCTION public.record_owner_completion_review(_id uuid, _status text, _internal_note text DEFAULT NULL::text, _follow_up_task_id uuid DEFAULT NULL::uuid, _owner_feedback text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; _cur text; _rid uuid; _mid uuid; _home text; _name text; _pm uuid;
  t_creator uuid; t_assignee uuid; f_assignee uuid; _to uuid[];
  _note text := nullif(trim(coalesce(_internal_note,'')), '');
  _fb text := nullif(trim(coalesce(_owner_feedback,'')), '');
BEGIN
  IF NOT (private.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Only ARHA staff can review owner completions.';
  END IF;
  IF _status NOT IN ('needs_review','follow_up_needed','reviewed') THEN RAISE EXCEPTION 'Unknown review status.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id = wi.program_id
   WHERE wi.id = _id AND wi.kind = 'opportunity';
  IF w.id IS NULL OR w.status <> 'complete' THEN RAISE EXCEPTION 'Only owner-completed Opportunities can be reviewed.'; END IF;
  IF NOT private.onboarding_scope_ok(auth.uid(), w.property_id) THEN RAISE EXCEPTION 'This home is outside your onboarding scope.'; END IF;
  IF length(coalesce(_note,'')) > 5000 OR length(coalesce(_fb,'')) > 5000 THEN RAISE EXCEPTION 'Please keep notes under 5,000 characters.'; END IF;
  IF _status = 'follow_up_needed' AND _note IS NULL AND _follow_up_task_id IS NULL THEN
    RAISE EXCEPTION 'Say what follow-up is needed, or link the Task that will handle it.';
  END IF;
  IF _follow_up_task_id IS NOT NULL THEN
    SELECT assigned_to INTO f_assignee FROM onboarding_tasks WHERE id = _follow_up_task_id AND property_id = w.property_id AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'The follow-up Task must belong to this home.'; END IF;
  END IF;
  SELECT status INTO _cur FROM owner_completion_reviews WHERE work_item_id = w.id ORDER BY created_at DESC LIMIT 1;
  IF coalesce(_cur,'needs_review') = _status AND _note IS NULL AND _fb IS NULL AND _follow_up_task_id IS NULL THEN
    RAISE EXCEPTION 'Nothing new to record.';
  END IF;
  IF _fb IS NOT NULL THEN
    IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so feedback cannot be shared.'; END IF;
    SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id = auth.uid();
    INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
    VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'staff', coalesce(_name,'Your ARHA team'), NULL, _fb, coalesce(w.is_demo,false))
    RETURNING id INTO _mid;
    SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id = w.property_id;
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3', 'Feedback from Your ARHA Team', w.title||' · '||_home,
      '/owner?home='||w.property_id||'&opportunity='||w.id, 'skipped', coalesce(w.is_demo,false));
  END IF;
  INSERT INTO owner_completion_reviews(work_item_id, status, internal_note, follow_up_task_id, owner_feedback_message_id, actor_id, is_demo)
  VALUES (w.id, _status, _note, _follow_up_task_id, _mid, auth.uid(), coalesce(w.is_demo,false))
  RETURNING id INTO _rid;
  IF w.source_task_id IS NOT NULL THEN
    SELECT created_by, assigned_to INTO t_creator, t_assignee FROM onboarding_tasks WHERE id = w.source_task_id;
  END IF;
  SELECT project_manager INTO _pm FROM onboarding_projects WHERE property_id = w.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  _to := ARRAY[_pm, t_creator, t_assignee, w.assigned_to, f_assignee]
      || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id = w.property_id), '{}');
  IF _pm IS NULL THEN _to := _to || public.seat_holder('onboarding_director'); END IF;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id = w.property_id;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_completion_review',
    'Owner completion '||CASE _status WHEN 'reviewed' THEN 'reviewed' WHEN 'follow_up_needed' THEN 'needs follow-up' ELSE 'returned to review' END
      ||CASE WHEN _fb IS NOT NULL THEN ' · feedback shared with owner' ELSE '' END,
    w.title||' · '||_home, 'work_item', w.id,
    '/onboarding/'||w.property_id||'?tab=work'||CASE WHEN _follow_up_task_id IS NOT NULL THEN '&task='||_follow_up_task_id
      WHEN w.source_task_id IS NOT NULL THEN '&task='||w.source_task_id ELSE '' END,
    w.is_demo);
  RETURN _rid;
END $function$
;

CREATE OR REPLACE FUNCTION public.release_owner_program_activities(_program_id uuid, _expected_version uuid, _preview boolean DEFAULT true, _expected_count integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.owner_programs; missing int; prepared int; total int; opened int;
 homes text[]; seeded jsonb; added int:=0; nid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only an Admin or Onboarding Director can release activities.';
 END IF;
 -- Retain canonical identity, demo, lifecycle, version and locking checks.
 p:=private.owner_lifecycle_program(_program_id,_expected_version,true);
 IF coalesce(private.is_synthetic_account(),false) AND NOT p.is_demo THEN
  RAISE EXCEPTION 'Test accounts can only release demo activities.';
 END IF;
 IF p.status NOT IN ('draft','active','target_reached') THEN
  RAISE EXCEPTION 'This program must be draft or active before releasing activities.';
 END IF;
 IF p.owner_user_id IS NULL THEN RAISE EXCEPTION 'Link the homeowner login before releasing activities.'; END IF;
 PERFORM 1 FROM owner_program_properties WHERE program_id=p.id ORDER BY property_id FOR SHARE;
 PERFORM 1 FROM owner_task_templates WHERE active ORDER BY id FOR SHARE;
 SELECT array_agg(coalesce(nullif(trim(h.nickname),''),h.name) ORDER BY h.name) INTO homes
 FROM owner_program_properties e JOIN properties h ON h.id=e.property_id
 WHERE e.program_id=p.id AND e.inclusion_status='included';
 IF coalesce(cardinality(homes),0)=0 THEN RAISE EXCEPTION 'Include a home before releasing activities.'; END IF;
 IF p.status='draft' AND NOT EXISTS(
  SELECT 1 FROM owner_program_properties WHERE program_id=p.id AND inclusion_status='included'
   AND archived_at IS NULL AND closing_date IS NOT NULL
 ) THEN RAISE EXCEPTION 'Record a closing date before activating this program.'; END IF;
 -- Same template/property identity as change_owner_program(seed_roadmap).
 SELECT count(*)::int INTO missing FROM owner_task_templates t
 CROSS JOIN LATERAL (
  SELECT e.property_id FROM owner_program_properties e
   WHERE t.phase='onboarding' AND e.program_id=p.id AND e.inclusion_status='included'
  UNION ALL SELECT NULL::uuid WHERE t.phase='ongoing'
 ) target
 WHERE t.active AND t.phase IN ('onboarding','ongoing') AND NOT EXISTS(
   SELECT 1 FROM owner_reviews r WHERE r.program_id=p.id AND r.template_id=t.id
   AND r.property_id IS NOT DISTINCT FROM target.property_id
 );
 SELECT count(*)::int INTO prepared FROM owner_reviews
 WHERE program_id=p.id AND status='prepared' AND template_id IS NOT NULL;
 total:=missing+prepared;
 IF _preview THEN RETURN jsonb_build_object('programId',p.id,'count',total,'missing',missing,
  'prepared',prepared,'homes',to_jsonb(homes),'reportVersion',p.report_version); END IF;
 IF _expected_count IS NULL OR _expected_count<>total THEN
  RAISE EXCEPTION 'The activities changed. Review the current count before releasing.';
 END IF;
 IF total=0 THEN RETURN jsonb_build_object('programId',p.id,'added',0,'opened',0,'summaryId',NULL); END IF;
 IF p.status='draft' THEN
  PERFORM public.activate_owner_program(p.id,p.report_version,NULL);
  SELECT * INTO p FROM owner_programs WHERE id=p.id;
 END IF;
 PERFORM public.owner_release_batch_begin();
 seeded:=public.change_owner_program(p.id,p.report_version,'seed_roadmap',_phase=>'onboarding');
 added:=coalesce((seeded->>'added')::int,0);
 SELECT * INTO p FROM owner_programs WHERE id=p.id;
 seeded:=public.change_owner_program(p.id,p.report_version,'seed_roadmap',_phase=>'ongoing');
 added:=added+coalesce((seeded->>'added')::int,0);
 UPDATE owner_reviews SET status='awaiting_owner'
 WHERE program_id=p.id AND status='prepared' AND template_id IS NOT NULL;
 GET DIAGNOSTICS opened=ROW_COUNT;
 IF opened<>total THEN RAISE EXCEPTION 'The release count changed. Nothing was released; review again.'; END IF;
 nid:=public.owner_release_summary(p.id,opened,NULL);
 IF NOT p.is_demo AND nid IS NULL THEN RAISE EXCEPTION 'The summary could not be queued. Nothing was released.'; END IF;
 RETURN jsonb_build_object('programId',p.id,'added',added,'opened',opened,'summaryId',nid);
END $function$
;

CREATE OR REPLACE FUNCTION public.request_owner_response(_id uuid, _body text, _kind text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; _name text; _mid uuid; _home text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can request a homeowner response.'; END IF;
  IF _kind NOT IN ('feedback','decision') THEN RAISE EXCEPTION 'Choose feedback or a decision.'; END IF;
  IF coalesce(trim(_body),'')='' THEN RAISE EXCEPTION 'Explain what you are asking the homeowner.'; END IF;
  IF length(_body) > 5000 THEN RAISE EXCEPTION 'Please keep your message under 5,000 characters.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived') FOR UPDATE OF wi;
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  IF w.status='complete' THEN RAISE EXCEPTION 'Reopen this request before asking for another response.'; END IF;
  IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so this cannot be sent.'; END IF;
  -- Let the owner answer with the requested kind; earlier response types and answers are preserved.
  UPDATE work_items SET response_types = array_append(response_types, _kind)
   WHERE id=w.id AND NOT (_kind = ANY(coalesce(response_types,'{}')));
  SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id=auth.uid();
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, request_kind, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'staff', coalesce(_name,'Your ARHA team'), 'response_requested', _kind, trim(_body), coalesce(w.is_demo,false))
  RETURNING id INTO _mid;
  SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id=w.property_id;
  INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
  VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3',
    CASE WHEN _kind='decision' THEN 'Your ARHA Team needs your decision' ELSE 'Your ARHA Team is asking for your feedback' END,
    w.title||' · '||_home, '/owner?home='||w.property_id||'&opportunity='||w.id,
    CASE WHEN coalesce(w.is_demo,false) THEN 'skipped' ELSE 'pending' END, coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'owner_response_requested', 'work_item', w.id, w.title, jsonb_build_object('kind', _kind, 'message_id', _mid));
  RETURN _mid;
END $function$
;

CREATE OR REPLACE FUNCTION public.str_report_context(_property uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;