-- Undo for mark-done-breezeway: puts back the exact live definition captured before apply, and writes an audit row.
CREATE OR REPLACE FUNCTION public.bulk_complete_onboarding_tasks(_property_id uuid, _task_ids uuid[], _note text, _done_on date DEFAULT NULL::date, _file_task_id uuid DEFAULT NULL::uuid, _dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _project public.onboarding_projects%ROWTYPE;
  _note_clean text := btrim(COALESCE(_note, ''));
  _file_name text;
  _evidence text;
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
  _completed_at timestamptz;
  _held jsonb := '[]'::jsonb;
  _ready jsonb := '[]'::jsonb;
  _saved jsonb := '[]'::jsonb;
  _approved jsonb := '[]'::jsonb;
  _covered jsonb := '[]'::jsonb;
  _rows jsonb := '[]'::jsonb;
  _audit jsonb;
  _cards jsonb;
  _before jsonb;
  _n integer;
  _batch uuid;
  s record;
  t public.onboarding_tasks%ROWTYPE;
BEGIN
  IF _actor IS NULL OR NOT private.plan_catch_up_gate(_actor) THEN
    RAISE EXCEPTION 'Only onboarding staff can update these Tasks.';
  END IF;
  _task_ids := COALESCE((SELECT array_agg(DISTINCT id) FROM unnest(_task_ids) ids(id)), '{}'::uuid[]);
  IF cardinality(_task_ids) = 0 THEN RAISE EXCEPTION 'Select at least one Task.'; END IF;
  IF cardinality(_task_ids) > 200 THEN RAISE EXCEPTION 'Select 200 Tasks or fewer at a time.'; END IF;
  IF _done_on IS NOT NULL AND (_done_on > _today OR _done_on < _today - 730) THEN
    RAISE EXCEPTION 'Pick a date in the last two years, not in the future.';
  END IF;

  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Start the onboarding project before completing its tasks.'; END IF;
  IF private.onboarding_work_locked(ARRAY[_property_id]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked. Reopen a task with a reason instead.';
  END IF;

  IF NOT _dry_run AND char_length(_note_clean) < 5 THEN
    RAISE EXCEPTION 'Add a note that says where the proof is (at least 5 characters).';
  END IF;
  IF _file_task_id IS NOT NULL THEN
    IF NOT (_file_task_id = ANY(_task_ids)) THEN RAISE EXCEPTION 'The shared file must be on one of the selected Tasks.'; END IF;
    SELECT COALESCE(original_filename, title) INTO _file_name FROM public.documents
      WHERE entity_type = 'onboarding_task' AND entity_id = _file_task_id AND upload_status = 'stored'
        AND deleted_at IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1;
    IF _file_name IS NULL THEN RAISE EXCEPTION 'The shared file is not stored yet. Try again in a moment.'; END IF;
  END IF;
  _evidence := concat_ws(E'\n', NULLIF(_note_clean, ''),
                         CASE WHEN _file_name IS NOT NULL THEN 'File: ' || _file_name END,
                         CASE WHEN _done_on IS NOT NULL THEN 'Done before Resolve on ' || to_char(_done_on, 'YYYY-MM-DD') || '.' END);
  _completed_at := CASE WHEN _done_on IS NULL THEN now()
                        ELSE (_done_on + time '12:00') AT TIME ZONE 'America/Chicago' END;

  PERFORM 1 FROM public.onboarding_tasks WHERE property_id = _property_id AND id = ANY(_task_ids) FOR UPDATE;
  DROP TABLE IF EXISTS pg_temp.bulk_complete_selected;
  CREATE TEMPORARY TABLE bulk_complete_selected ON COMMIT DROP AS
  SELECT x.*,
    (x.held_reason IS NULL AND x.needs_approval) AS approve_outside
  FROM (
    SELECT ot.id, ot.title, ot.sort_order,
      ((ot.owner_dependency = 'business_decision' OR COALESCE(ot.requires_owner_approval, false))
        AND ot.owner_approval_status IS DISTINCT FROM 'approved') AS needs_approval,
      CASE
        WHEN ot.status IN ('complete', 'done', 'carryover') THEN 'Already done.'
        WHEN ot.archived_at IS NOT NULL OR ot.exception_at IS NOT NULL THEN 'Not needed or recorded as an exception.'
        WHEN NOT private.plan_catch_up_can(_actor, _project.project_manager, ot.assigned_to, ot.assigned_seat)
          THEN 'Not assigned to you or your role.'
        WHEN (ot.owner_dependency = 'business_decision' OR COALESCE(ot.requires_owner_approval, false))
             AND ot.owner_approval_status IS DISTINCT FROM 'approved' AND _done_on IS NULL
          THEN 'Needs the homeowner''s approval first.'
        WHEN (ot.owner_dependency = 'business_decision' OR COALESCE(ot.requires_owner_approval, false))
             AND ot.owner_approval_status IS DISTINCT FROM 'approved' AND private.plan_catch_up_owner_asked(ot.id)
          THEN 'Already sent to the homeowner. Record their answer on the Task.'
        WHEN NULLIF(btrim(COALESCE(ot.blocker, '')), '') IS NOT NULL THEN 'Blocked: ' || btrim(ot.blocker)
        WHEN private.plan_catch_up_bz_sent(ot.id) THEN 'A Breezeway work order was already sent for it.'
        WHEN EXISTS (SELECT 1 FROM public.onboarding_step_review_settings rs
                     WHERE rs.template_task_id = ot.template_task_id AND cardinality(rs.reviewer_roles) > 0)
             AND COALESCE((SELECT r.status FROM public.onboarding_task_reviews r WHERE r.task_id = ot.id
                           ORDER BY r.submitted_at DESC, r.round DESC LIMIT 1), '') NOT IN ('approved', 'skipped')
          THEN 'Needs review first. Open it and use Submit for review.'
        WHEN private.onboarding_bulk_review_blocker(ot.id) IS NOT NULL THEN 'Waiting on review of ' || private.onboarding_bulk_review_blocker(ot.id) || '.'
        WHEN (SELECT e.new_value::jsonb->>'status' FROM public.onboarding_project_events e
              WHERE e.project_id = _project.id AND e.kind = 'stage_capture:' || ot.stage
              ORDER BY (e.new_value::jsonb->>'revision')::integer DESC LIMIT 1) IN ('complete', 'awaiting_review')
          THEN 'Its stage is under review or complete. Return or reopen the stage first.'
        ELSE NULL
      END AS held_reason
    FROM public.onboarding_tasks ot
    WHERE ot.property_id = _property_id AND ot.id = ANY(_task_ids)
  ) x;

  SELECT count(*) INTO _n FROM bulk_complete_selected;
  IF _n <> cardinality(_task_ids) THEN
    RAISE EXCEPTION 'Some selected Tasks are not on this home''s plan. Refresh and try again.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title, 'reason', held_reason) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _held FROM bulk_complete_selected WHERE held_reason IS NOT NULL;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _ready FROM bulk_complete_selected WHERE held_reason IS NULL;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _approved FROM bulk_complete_selected WHERE approve_outside;

  IF _dry_run THEN
    RETURN jsonb_build_object('ready', _ready, 'held', _held, 'completed', 0, 'approvedOutside', _approved,
      'covered', private.plan_catch_up_cards(_actor, _property_id,
        COALESCE((SELECT array_agg(id) FROM bulk_complete_selected WHERE held_reason IS NULL), '{}'::uuid[]),
        'done_outside_resolve', false));
  END IF;

  _approved := '[]'::jsonb;
  FOR s IN SELECT * FROM bulk_complete_selected WHERE held_reason IS NULL ORDER BY sort_order, id LOOP
    BEGIN
      SELECT * INTO t FROM public.onboarding_tasks WHERE id = s.id FOR UPDATE;
      _before := private.plan_catch_up_state(to_jsonb(t));
      _cards := private.plan_catch_up_cards(_actor, _property_id, ARRAY[s.id], 'done_outside_resolve', true);
      IF s.approve_outside THEN
        UPDATE public.onboarding_tasks SET owner_approval_status = 'approved' WHERE id = s.id;
      END IF;
      UPDATE public.onboarding_tasks SET
        status = 'complete',
        blocker = NULL,
        evidence_note = concat_ws(E'\n', NULLIF(btrim(COALESCE(t.evidence_note, '')), ''), _evidence,
                                  CASE WHEN s.approve_outside THEN 'Approved outside Resolve: ' || _note_clean END),
        completed_at = _completed_at,
        completed_by = _actor
      WHERE id = s.id;
      IF s.approve_outside THEN
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
        VALUES (_project.id, _property_id, 'owner_decision', 'Approved outside Resolve: "' || s.title || '"',
                'Approved outside Resolve: ' || _note_clean, COALESCE(t.owner_approval_status, 'not_required'), 'approved',
                _actor, COALESCE(t.is_demo, false));
        _approved := _approved || jsonb_build_array(jsonb_build_object('taskId', s.id, 'title', s.title));
      END IF;
      SELECT * INTO t FROM public.onboarding_tasks WHERE id = s.id;
      _rows := _rows || jsonb_build_array(jsonb_build_object('taskId', s.id, 'title', s.title, 'before', _before,
        'after', private.plan_catch_up_state(to_jsonb(t))));
      _saved := _saved || jsonb_build_array(jsonb_build_object('taskId', s.id, 'title', s.title));
      _covered := _covered || _cards;
    EXCEPTION WHEN OTHERS THEN
      _held := _held || jsonb_build_array(jsonb_build_object('taskId', s.id, 'title', s.title, 'reason', SQLERRM));
    END;
  END LOOP;

  _n := jsonb_array_length(_saved);
  IF _n > 0 THEN
    _batch := private.plan_catch_up_record(_actor, _property_id, _project.id, 'mark_done',
      jsonb_build_object('done_on', _done_on, 'note', _note_clean, 'file_task_id', _file_task_id, 'file_name', _file_name,
                         'approved_outside', _approved),
      _rows, _covered, COALESCE(_project.is_demo, false), NULL, NULL);
    SELECT jsonb_agg(jsonb_build_object('taskId', r->>'taskId', 'title', r->>'title', 'before', r->'before',
             'after', (r->'after') || jsonb_build_object('done_before_resolve', _done_on, 'shared_file', _file_name,
               'shared_file_task_id', _file_task_id, 'batch_size', _n, 'batch_id', _batch,
               'approved_outside_resolve', _approved @> jsonb_build_array(jsonb_build_object('taskId', (r->>'taskId')::uuid, 'title', r->>'title')),
               'covered_cards', (SELECT COALESCE(jsonb_agg(c->>'title'), '[]'::jsonb) FROM jsonb_array_elements(_covered) c WHERE c->>'taskId' = r->>'taskId'))))
      INTO _audit FROM jsonb_array_elements(_rows) r;
    PERFORM private.write_onboarding_bulk_completion(_actor, _audit,
      CASE WHEN _saved @> jsonb_build_array(jsonb_build_object('taskId', _file_task_id)) THEN _file_task_id END);
  END IF;

  RETURN jsonb_build_object('ready', _saved, 'held', _held, 'completed', _n, 'completedAt', _completed_at,
    'doneBeforeResolve', _done_on, 'batchId', _batch, 'covered', _covered, 'approvedOutside', _approved);
END $function$;

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'mark_done_breezeway.undo', 'function', 'bulk_complete_onboarding_tasks',
  'Undo of mark-done-breezeway: Mark done holds Tasks with a sent Breezeway work order again.', NULL, NULL);
