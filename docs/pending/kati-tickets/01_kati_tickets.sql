-- Build 15: Kati's three onboarding tickets (help tickets 65, 66, 67). Approved by Emily Nov 10.
-- Applied from docs/pending/kati-tickets/01_kati_tickets.sql (sha256 336bdf25e1d101196ed85a5d74f78d6a28dad87c8b9d6da6e75eb95469fcfa90).
-- Additive only. Nothing here changes an existing table, function, trigger, policy or row.

CREATE OR REPLACE FUNCTION private.write_onboarding_bulk_completion(_actor uuid, _rows jsonb, _file_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $fn$
DECLARE _property uuid;
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A signed-in teammate is required.';
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  SELECT _actor, 'onboarding_task_bulk_completed', 'onboarding_task', (r->>'taskId')::uuid, r->>'title',
         r->'before', r->'after'
  FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) r;
  IF _file_task_id IS NOT NULL THEN
    SELECT property_id INTO _property FROM public.onboarding_tasks WHERE id = _file_task_id;
    INSERT INTO public.onboarding_task_file_links(property_id, receiving_task_id, source_task_id, origin, created_by)
    SELECT _property, (r->>'taskId')::uuid, _file_task_id, 'manual', _actor
    FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) r
    WHERE (r->>'taskId')::uuid <> _file_task_id
      AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_file_links l
                      WHERE l.receiving_task_id = (r->>'taskId')::uuid AND l.source_task_id = _file_task_id
                        AND l.removed_at IS NULL);
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION private.write_onboarding_bulk_completion(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.write_onboarding_bulk_completion(uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_complete_onboarding_tasks(
  _property_id uuid,
  _task_ids uuid[],
  _note text,
  _done_on date DEFAULT NULL,
  _file_task_id uuid DEFAULT NULL,
  _dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'private'
AS $fn$
DECLARE
  _actor uuid := auth.uid();
  _project public.onboarding_projects%ROWTYPE;
  _lead boolean;
  _note_clean text := btrim(COALESCE(_note, ''));
  _file_name text;
  _evidence text;
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
  _completed_at timestamptz;
  _held jsonb;
  _ready jsonb;
  _audit jsonb;
  _n integer;
BEGIN
  IF _actor IS NULL OR NOT COALESCE(private.is_onboarding_staff(_actor), false) THEN
    RAISE EXCEPTION 'Onboarding staff access is required.';
  END IF;
  _task_ids := COALESCE((SELECT array_agg(DISTINCT id) FROM unnest(_task_ids) ids(id)), '{}'::uuid[]);
  IF cardinality(_task_ids) = 0 THEN RAISE EXCEPTION 'Tick at least one task.'; END IF;
  IF cardinality(_task_ids) > 200 THEN RAISE EXCEPTION 'Tick 200 tasks or fewer at a time.'; END IF;
  IF _done_on IS NOT NULL AND (_done_on > _today OR _done_on < _today - 730) THEN
    RAISE EXCEPTION 'Pick a date in the last two years, not in the future.';
  END IF;

  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Start the onboarding project before completing its tasks.'; END IF;
  IF private.onboarding_work_locked(ARRAY[_property_id]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked. Reopen a task with a reason instead.';
  END IF;
  _lead := COALESCE(private.is_supervisor(_actor) OR public.is_onboarding_director(_actor)
                    OR _project.project_manager = _actor OR _project.director = _actor, false);

  IF _file_task_id IS NOT NULL THEN
    IF NOT (_file_task_id = ANY(_task_ids)) THEN RAISE EXCEPTION 'The shared file must be on one of the ticked tasks.'; END IF;
    SELECT COALESCE(original_filename, title) INTO _file_name FROM public.documents
      WHERE entity_type = 'onboarding_task' AND entity_id = _file_task_id AND upload_status = 'stored'
        AND deleted_at IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1;
    IF _file_name IS NULL THEN RAISE EXCEPTION 'The shared file is not stored yet. Try again in a moment.'; END IF;
  END IF;
  IF char_length(_note_clean) < 5 AND _file_name IS NULL THEN
    RAISE EXCEPTION 'Add a note that says where the proof is (at least 5 characters), or attach a file.';
  END IF;
  _evidence := concat_ws(E'\n', NULLIF(_note_clean, ''),
                         CASE WHEN _file_name IS NOT NULL THEN 'File: ' || _file_name END,
                         CASE WHEN _done_on IS NOT NULL THEN 'Done before Resolve on ' || to_char(_done_on, 'YYYY-MM-DD') || '.' END);
  _completed_at := CASE WHEN _done_on IS NULL THEN now()
                        ELSE (_done_on + time '12:00') AT TIME ZONE 'America/Chicago' END;

  PERFORM 1 FROM public.onboarding_tasks WHERE property_id = _property_id AND id = ANY(_task_ids) FOR UPDATE;
  DROP TABLE IF EXISTS pg_temp.bulk_complete_selected;
  CREATE TEMPORARY TABLE bulk_complete_selected ON COMMIT DROP AS
  SELECT t.id, t.title, t.sort_order, t.status, t.evidence_note, t.completed_at, t.completed_by,
    CASE
      WHEN t.status IN ('complete', 'done', 'carryover') THEN 'Already done.'
      WHEN t.archived_at IS NOT NULL OR t.exception_at IS NOT NULL THEN 'Voided or recorded as an exception.'
      WHEN NOT _lead AND t.assigned_to IS DISTINCT FROM _actor THEN 'Not assigned to you.'
      WHEN (t.owner_dependency = 'business_decision' OR COALESCE(t.requires_owner_approval, false))
           AND t.owner_approval_status IS DISTINCT FROM 'approved' THEN 'Needs the homeowner''s approval first.'
      WHEN NULLIF(btrim(COALESCE(t.blocker, '')), '') IS NOT NULL THEN 'Blocked: ' || btrim(t.blocker)
      WHEN EXISTS (SELECT 1 FROM public.onboarding_step_review_settings s
                   WHERE s.template_task_id = t.template_task_id AND cardinality(s.reviewer_roles) > 0)
           AND COALESCE((SELECT r.status FROM public.onboarding_task_reviews r WHERE r.task_id = t.id
                         ORDER BY r.submitted_at DESC, r.round DESC LIMIT 1), '') NOT IN ('approved', 'skipped')
        THEN 'Needs review first. Open it and use Submit for review.'
      WHEN private.review_blocker(t.id) IS NOT NULL THEN 'Waiting on review of ' || private.review_blocker(t.id) || '.'
      WHEN (SELECT e.new_value::jsonb->>'status' FROM public.onboarding_project_events e
            WHERE e.project_id = _project.id AND e.kind = 'stage_capture:' || t.stage
            ORDER BY (e.new_value::jsonb->>'revision')::integer DESC LIMIT 1) IN ('complete', 'awaiting_review')
        THEN 'Its stage is under review or complete. Return or reopen the stage first.'
      ELSE NULL
    END AS held_reason
  FROM public.onboarding_tasks t
  WHERE t.property_id = _property_id AND t.id = ANY(_task_ids);

  SELECT count(*) INTO _n FROM bulk_complete_selected;
  IF _n <> cardinality(_task_ids) THEN
    RAISE EXCEPTION 'Some ticked tasks are not on this home''s plan. Refresh and try again.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title, 'reason', held_reason) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _held FROM bulk_complete_selected WHERE held_reason IS NOT NULL;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _ready FROM bulk_complete_selected WHERE held_reason IS NULL;

  IF _dry_run THEN
    RETURN jsonb_build_object('ready', _ready, 'held', _held, 'completed', 0);
  END IF;
  IF jsonb_array_length(_held) > 0 THEN
    RAISE EXCEPTION 'Nothing was completed. Untick these tasks first: %',
      (SELECT string_agg((h->>'title') || ' (' || (h->>'reason') || ')', '; ') FROM jsonb_array_elements(_held) h);
  END IF;
  IF _file_task_id IS NOT NULL AND (SELECT held_reason FROM bulk_complete_selected WHERE id = _file_task_id) IS NOT NULL THEN
    RAISE EXCEPTION 'The shared file must be on a task that is being completed.';
  END IF;

  UPDATE public.onboarding_tasks t SET
    status = 'complete',
    blocker = NULL,
    evidence_note = CASE WHEN NULLIF(btrim(COALESCE(t.evidence_note, '')), '') IS NULL THEN _evidence
                         ELSE btrim(t.evidence_note) || E'\n' || _evidence END,
    completed_at = _completed_at,
    completed_by = _actor
  FROM bulk_complete_selected s
  WHERE t.id = s.id;
  GET DIAGNOSTICS _n = ROW_COUNT;

  SELECT jsonb_agg(jsonb_build_object(
    'taskId', s.id, 'title', s.title,
    'before', jsonb_build_object('status', s.status, 'evidence_note', s.evidence_note),
    'after', jsonb_build_object('status', 'complete', 'evidence_note', t.evidence_note,
                                'completed_at', t.completed_at, 'completed_by', _actor,
                                'done_before_resolve', _done_on, 'shared_file', _file_name,
                                'shared_file_task_id', _file_task_id, 'batch_size', _n))
    ORDER BY s.sort_order, s.id)
  INTO _audit
  FROM bulk_complete_selected s JOIN public.onboarding_tasks t ON t.id = s.id;
  PERFORM private.write_onboarding_bulk_completion(_actor, _audit, _file_task_id);

  RETURN jsonb_build_object('ready', _ready, 'held', '[]'::jsonb, 'completed', _n,
                            'completedAt', _completed_at, 'doneBeforeResolve', _done_on);
END $fn$;
REVOKE ALL ON FUNCTION public.bulk_complete_onboarding_tasks(uuid, uuid[], text, date, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_complete_onboarding_tasks(uuid, uuid[], text, date, uuid, boolean) TO authenticated;

CREATE TABLE public.onboarding_task_breezeway_links (
  task_id uuid PRIMARY KEY REFERENCES public.onboarding_tasks(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  tentative_date date,
  assignee_choice text CHECK (assignee_choice IN ('unassigned', 'person')),
  breezeway_person_id bigint,
  assignee_name text,
  breezeway_task_id bigint,
  breezeway_url text CHECK (breezeway_url IS NULL OR breezeway_url ~ '^https://app\.breezeway\.io/'),
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_task_breezeway_person_chk CHECK (
    (assignee_choice = 'person') = (breezeway_person_id IS NOT NULL))
);
CREATE UNIQUE INDEX onboarding_task_breezeway_links_task_once
  ON public.onboarding_task_breezeway_links(breezeway_task_id) WHERE breezeway_task_id IS NOT NULL;
CREATE INDEX onboarding_task_breezeway_links_property ON public.onboarding_task_breezeway_links(property_id);
GRANT SELECT ON public.onboarding_task_breezeway_links TO authenticated;
GRANT ALL ON public.onboarding_task_breezeway_links TO service_role;
ALTER TABLE public.onboarding_task_breezeway_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read onboarding Breezeway links" ON public.onboarding_task_breezeway_links
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Synthetic accounts: demo records only" ON public.onboarding_task_breezeway_links
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT (SELECT private.is_synthetic_account())) OR is_demo IS TRUE)
  WITH CHECK ((NOT (SELECT private.is_synthetic_account())) OR is_demo IS TRUE);

CREATE TABLE public.onboarding_task_breezeway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  actor uuid NOT NULL,
  before_value jsonb,
  after_value jsonb NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_task_breezeway_events_task ON public.onboarding_task_breezeway_events(task_id, created_at DESC);
GRANT SELECT ON public.onboarding_task_breezeway_events TO authenticated;
GRANT ALL ON public.onboarding_task_breezeway_events TO service_role;
ALTER TABLE public.onboarding_task_breezeway_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read onboarding Breezeway history" ON public.onboarding_task_breezeway_events
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Synthetic accounts: demo records only" ON public.onboarding_task_breezeway_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT (SELECT private.is_synthetic_account())) OR is_demo IS TRUE)
  WITH CHECK ((NOT (SELECT private.is_synthetic_account())) OR is_demo IS TRUE);

CREATE OR REPLACE FUNCTION private.block_onboarding_breezeway_event_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
BEGIN
  RAISE EXCEPTION 'Breezeway link history is kept as it was recorded.';
END $fn$;
CREATE TRIGGER block_onboarding_breezeway_event_change
  BEFORE UPDATE OR DELETE ON public.onboarding_task_breezeway_events
  FOR EACH ROW EXECUTE FUNCTION private.block_onboarding_breezeway_event_change();

CREATE OR REPLACE FUNCTION public.save_onboarding_task_breezeway(
  _task_id uuid,
  _tentative_date date,
  _assignee_choice text,
  _breezeway_person_id bigint,
  _breezeway_ref text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $fn$
DECLARE
  _actor uuid := auth.uid();
  _task public.onboarding_tasks%ROWTYPE;
  _project public.onboarding_projects%ROWTYPE;
  _prior public.onboarding_task_breezeway_links%ROWTYPE;
  _had_prior boolean;
  _ref text := btrim(COALESCE(_breezeway_ref, ''));
  _bz_id bigint;
  _bz_url text;
  _name text;
  _other text;
  _saved public.onboarding_task_breezeway_links%ROWTYPE;
BEGIN
  IF _actor IS NULL OR NOT COALESCE(private.is_onboarding_staff(_actor), false) THEN
    RAISE EXCEPTION 'Onboarding staff access is required.';
  END IF;
  SELECT * INTO _task FROM public.onboarding_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND OR _task.archived_at IS NOT NULL THEN RAISE EXCEPTION 'That task is not available.'; END IF;
  IF _task.title !~* '^\s*work order\s*:' THEN
    RAISE EXCEPTION 'Only Work order tasks carry a Breezeway work order.';
  END IF;
  IF private.onboarding_work_locked(ARRAY[_task.property_id]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked.';
  END IF;
  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _task.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF NOT COALESCE(private.is_supervisor(_actor) OR public.is_onboarding_director(_actor)
                  OR _project.project_manager = _actor OR _project.director = _actor
                  OR _task.assigned_to = _actor, false) THEN
    RAISE EXCEPTION 'This work is not assigned to you or a project you lead.';
  END IF;

  IF _assignee_choice IS NOT NULL AND _assignee_choice NOT IN ('unassigned', 'person') THEN
    RAISE EXCEPTION 'Choose a Breezeway person or Leave unassigned.';
  END IF;
  IF _assignee_choice = 'person' THEN
    SELECT btrim(concat_ws(' ', first_name, last_name)) INTO _name FROM public.breezeway_people
      WHERE breezeway_person_id = _breezeway_person_id AND active AND NOT COALESCE(is_integration_identity, false);
    IF _name IS NULL THEN RAISE EXCEPTION 'That person is not active in Breezeway.'; END IF;
  ELSE
    _breezeway_person_id := NULL;
  END IF;

  IF _ref <> '' THEN
    IF _ref ~ '^#?[0-9]{1,15}$' THEN
      _bz_id := replace(_ref, '#', '')::bigint;
    ELSIF _ref ~* '^https://app\.breezeway\.io/\S*?\mtasks?/[0-9]{1,15}' THEN
      _bz_id := substring(_ref from '(?i)tasks?/([0-9]{1,15})')::bigint;
      _bz_url := _ref;
    ELSE
      RAISE EXCEPTION 'Paste the Breezeway task number, or its link from app.breezeway.io.';
    END IF;
    SELECT t.title INTO _other FROM public.onboarding_task_breezeway_links l
      JOIN public.onboarding_tasks t ON t.id = l.task_id
      WHERE l.breezeway_task_id = _bz_id AND l.task_id <> _task_id;
    IF _other IS NOT NULL THEN RAISE EXCEPTION 'That Breezeway task is already linked to %.', _other; END IF;
  END IF;

  SELECT * INTO _prior FROM public.onboarding_task_breezeway_links WHERE task_id = _task_id FOR UPDATE;
  _had_prior := FOUND;
  INSERT INTO public.onboarding_task_breezeway_links AS l(
    task_id, property_id, tentative_date, assignee_choice, breezeway_person_id, assignee_name,
    breezeway_task_id, breezeway_url, is_demo, created_by, updated_by)
  VALUES (_task_id, _task.property_id, _tentative_date, _assignee_choice, _breezeway_person_id, _name,
          _bz_id, _bz_url, COALESCE(_task.is_demo, false), _actor, _actor)
  ON CONFLICT (task_id) DO UPDATE SET
    tentative_date = EXCLUDED.tentative_date,
    assignee_choice = EXCLUDED.assignee_choice,
    breezeway_person_id = EXCLUDED.breezeway_person_id,
    assignee_name = EXCLUDED.assignee_name,
    breezeway_task_id = EXCLUDED.breezeway_task_id,
    breezeway_url = EXCLUDED.breezeway_url,
    updated_by = _actor,
    updated_at = now()
  RETURNING * INTO _saved;

  INSERT INTO public.onboarding_task_breezeway_events(task_id, property_id, actor, before_value, after_value, is_demo)
  VALUES (_task_id, _task.property_id, _actor,
          CASE WHEN _had_prior THEN jsonb_build_object(
            'tentative_date', _prior.tentative_date, 'assignee_choice', _prior.assignee_choice,
            'breezeway_person_id', _prior.breezeway_person_id, 'assignee_name', _prior.assignee_name,
            'breezeway_task_id', _prior.breezeway_task_id, 'breezeway_url', _prior.breezeway_url) END,
          jsonb_build_object(
            'tentative_date', _saved.tentative_date, 'assignee_choice', _saved.assignee_choice,
            'breezeway_person_id', _saved.breezeway_person_id, 'assignee_name', _saved.assignee_name,
            'breezeway_task_id', _saved.breezeway_task_id, 'breezeway_url', _saved.breezeway_url),
          COALESCE(_task.is_demo, false));

  RETURN to_jsonb(_saved);
END $fn$;
REVOKE ALL ON FUNCTION public.save_onboarding_task_breezeway(uuid, date, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_task_breezeway(uuid, date, text, bigint, text) TO authenticated;

INSERT INTO public.feature_flags(key, label, description, enabled)
VALUES ('onboarding_breezeway_send', 'Send onboarding work orders to Breezeway',
        'Lets a Work order task create its Breezeway task once, for verified homes only. Off until a verification send.', false)
ON CONFLICT (key) DO NOTHING;