-- Build 15 fix forward (Kati ticket 65): bulk complete read the step-review blocker through a
-- function signed-in teammates may not call directly. A narrow wrapper answers the same question
-- for onboarding staff only; bulk_complete_onboarding_tasks now uses it. Nothing else changes.
CREATE OR REPLACE FUNCTION private.onboarding_bulk_review_blocker(_task_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.is_onboarding_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'Onboarding staff access is required.';
  END IF;
  RETURN private.review_blocker(_task_id);
END $fn$;
REVOKE ALL ON FUNCTION private.onboarding_bulk_review_blocker(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.onboarding_bulk_review_blocker(uuid) TO authenticated;

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
      WHEN private.onboarding_bulk_review_blocker(t.id) IS NOT NULL THEN 'Waiting on review of ' || private.onboarding_bulk_review_blocker(t.id) || '.'
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