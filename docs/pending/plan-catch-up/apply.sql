-- Plan catch-up: update many Tasks at once (Admin approval Nov 12; the Director of Onboarding's top priority).
-- STAGED ONLY. Run 00_preflight.sql first; it refuses if the live bulk complete changed since Nov 12.
-- Additive: one new table (Undo receipts), private helpers, one new action function, one undo function,
-- and a CREATE OR REPLACE of bulk_complete_onboarding_tasks with the same arguments (O8 now skips and saves).
-- Undo: apply.undo.sql.

-- 1. One row per bulk save, so Undo restores exactly those Tasks for 10 minutes.
CREATE TABLE IF NOT EXISTS public.onboarding_task_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('mark_done', 'not_needed', 'assign', 'due_date', 'reopen')),
  actor uuid NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  task_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  undo_until timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  undone_at timestamptz,
  undone_by uuid,
  undo_result jsonb
);
CREATE INDEX IF NOT EXISTS onboarding_task_batches_property_idx ON public.onboarding_task_batches (property_id, created_at DESC);
GRANT SELECT ON public.onboarding_task_batches TO authenticated;
GRANT ALL ON public.onboarding_task_batches TO service_role;
ALTER TABLE public.onboarding_task_batches ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.onboarding_task_batches IS 'Plan catch-up receipts: one row per bulk save on a home plan, used by Undo for 10 minutes.';
DROP POLICY IF EXISTS "Onboarding staff read task batches" ON public.onboarding_task_batches;
CREATE POLICY "Onboarding staff read task batches" ON public.onboarding_task_batches
  FOR SELECT TO authenticated USING (private.is_onboarding_staff(auth.uid()));

-- 2. Who may use it (item 7). Operations roles never; the database decides, not the screen.
CREATE OR REPLACE FUNCTION private.plan_catch_up_gate(_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
  SELECT _actor IS NOT NULL AND (
    public.has_role(_actor, 'admin') OR public.has_role(_actor, 'onboarding')
    OR coalesce(public.is_onboarding_director(_actor), false))
$$;

-- Director of Onboarding and Admin: every home. Project Manager: their own homes.
-- Utilities and Design (and anyone else in onboarding): only Tasks assigned to them or their role.
CREATE OR REPLACE FUNCTION private.plan_catch_up_can(_actor uuid, _project_manager uuid, _assigned_to uuid, _assigned_seat text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
  SELECT _actor IS NOT NULL AND (
    public.has_role(_actor, 'admin')
    OR coalesce(public.is_onboarding_director(_actor), false)
    OR (public.has_role(_actor, 'onboarding') AND (
          _project_manager = _actor
          OR _assigned_to = _actor
          OR (_assigned_seat = ANY (ARRAY['utilities', 'designer', 'lead_designer', 'design_staging', 'staging_team'])
              AND public.holds_functional_role(_actor, _assigned_seat)))))
$$;

-- A Breezeway work order already went out for this Task.
CREATE OR REPLACE FUNCTION private.plan_catch_up_bz_sent(_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.breezeway_outbound_tasks b WHERE b.onboarding_task_id = _task)
      OR EXISTS (SELECT 1 FROM public.onboarding_task_breezeway_links l WHERE l.task_id = _task AND l.breezeway_task_id IS NOT NULL)
$$;

-- The homeowner was already asked about this Task in Resolve and has not answered.
CREATE OR REPLACE FUNCTION private.plan_catch_up_owner_asked(_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.approvals a WHERE a.entity_type = 'onboarding_task' AND a.entity_id = _task AND a.status = 'pending')
      OR EXISTS (SELECT 1 FROM public.owner_reviews o WHERE o.onboarding_task_id = _task AND o.archived_at IS NULL AND o.status = 'awaiting_owner')
$$;

CREATE OR REPLACE FUNCTION private.plan_catch_up_person(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT coalesce(nullif(btrim(full_name), ''), email) FROM public.profiles WHERE id = _id), 'Unassigned')
$$;

-- The fields Undo restores, taken from to_jsonb(onboarding_tasks row).
CREATE OR REPLACE FUNCTION private.plan_catch_up_state(_t jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'status', _t->'status', 'completed_at', _t->'completed_at', 'completed_by', _t->'completed_by',
    'evidence_note', _t->'evidence_note', 'blocker', _t->'blocker', 'owner_approval_status', _t->'owner_approval_status',
    'archived_at', _t->'archived_at', 'archived_by', _t->'archived_by', 'exception_reason', _t->'exception_reason',
    'exception_by', _t->'exception_by', 'exception_at', _t->'exception_at', 'assigned_to', _t->'assigned_to',
    'assigned_seat', _t->'assigned_seat', 'due_on', _t->'due_on', 'due_on_overridden', _t->'due_on_overridden',
    'due_on_source', _t->'due_on_source', 'updated_at', _t->'updated_at')
$$;

-- 3. Owner plan cards these Tasks cover (same linkage as ao_preview_home_automation: the card's
-- linked template step on this home). On the plan and still waiting: marked already covered so the
-- owner never gets them. Plan not started yet: the done Task already counts as covered when it starts.
CREATE OR REPLACE FUNCTION private.plan_catch_up_cards(_actor uuid, _property uuid, _task_ids uuid[], _reason text, _apply boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE out jsonb := '[]'::jsonb; r record; hp jsonb;
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() OR NOT private.plan_catch_up_gate(_actor) THEN
    RAISE EXCEPTION 'A signed-in onboarding teammate is required.';
  END IF;
  IF _reason NOT IN ('done_outside_resolve', 'task_not_needed') THEN RAISE EXCEPTION 'Unknown cover reason.'; END IF;
  FOR r IN
    SELECT pc.id, pc.linked_task_id, pc.join_outcome, pc.covered_reason, pc.covered_source, pc.covered_item_id, c.code, c.title
      FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
     WHERE pc.property_id = _property AND pc.linked_task_id = ANY (_task_ids)
       AND pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL
       AND pc.owner_completed_at IS NULL AND pc.expired_at IS NULL
     ORDER BY c.code
  LOOP
    IF _apply THEN
      UPDATE public.ao_home_plan_cards SET join_outcome = 'already_covered', covered_reason = _reason,
        covered_source = 'onboarding_task', covered_item_id = r.linked_task_id
       WHERE id = r.id AND join_outcome = 'locked' AND unlocked_at IS NULL;
    END IF;
    out := out || jsonb_build_array(jsonb_build_object('planCardId', r.id, 'taskId', r.linked_task_id, 'code', r.code,
      'title', r.title, 'onPlan', true, 'before', jsonb_build_object('join_outcome', r.join_outcome,
      'covered_reason', r.covered_reason, 'covered_source', r.covered_source, 'covered_item_id', r.covered_item_id)));
  END LOOP;
  IF _reason = 'done_outside_resolve' AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings s WHERE s.property_id = _property) THEN
    hp := private.ao_home_program(_property);
    IF NOT (hp ? 'reason') THEN
      FOR r IN
        SELECT o.card_id, o.code, o.task_id, c.title FROM private.ao_plan_outcomes(_property) o
          JOIN public.ao_library_cards c ON c.id = o.card_id
         WHERE o.task_id = ANY (_task_ids) AND o.outcome IN ('locked', 'open') ORDER BY o.code
      LOOP
        out := out || jsonb_build_array(jsonb_build_object('planCardId', NULL, 'cardId', r.card_id, 'taskId', r.task_id,
          'code', r.code, 'title', r.title, 'onPlan', false));
      END LOOP;
    END IF;
  END IF;
  RETURN out;
END $$;

-- Undo for one Task: the cards it covered go back to waiting, and a shared file link made by the save is removed (kept on record).
CREATE OR REPLACE FUNCTION private.plan_catch_up_undo_extras(_actor uuid, _batch uuid, _task uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE b public.onboarding_task_batches%ROWTYPE; c jsonb; n integer := 0;
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'A signed-in teammate is required.'; END IF;
  SELECT * INTO b FROM public.onboarding_task_batches WHERE id = _batch AND undone_by = _actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'That save cannot be undone.'; END IF;
  FOR c IN SELECT x FROM jsonb_array_elements(b.cards) x WHERE x->>'taskId' = _task::text AND x->>'planCardId' IS NOT NULL LOOP
    UPDATE public.ao_home_plan_cards SET join_outcome = c->'before'->>'join_outcome',
      covered_reason = c->'before'->>'covered_reason', covered_source = c->'before'->>'covered_source',
      covered_item_id = (c->'before'->>'covered_item_id')::uuid
     WHERE id = (c->>'planCardId')::uuid AND join_outcome = 'already_covered' AND covered_item_id = _task;
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  IF b.action = 'mark_done' AND b.detail->>'file_task_id' IS NOT NULL THEN
    UPDATE public.onboarding_task_file_links SET removed_at = now(), removed_by = _actor
     WHERE receiving_task_id = _task AND source_task_id = (b.detail->>'file_task_id')::uuid
       AND created_at = b.created_at AND removed_at IS NULL;
  END IF;
  RETURN n;
END $$;

-- Receipts and history rows (the caller cannot insert these tables directly).
CREATE OR REPLACE FUNCTION private.plan_catch_up_record(_actor uuid, _property uuid, _project uuid, _action text,
  _detail jsonb, _rows jsonb, _cards jsonb, _is_demo boolean, _audit_action text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE _id uuid;
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() OR NOT private.plan_catch_up_gate(_actor) THEN
    RAISE EXCEPTION 'A signed-in onboarding teammate is required.';
  END IF;
  INSERT INTO public.onboarding_task_batches(property_id, project_id, action, actor, detail, task_rows, cards, is_demo)
    VALUES (_property, _project, _action, _actor, coalesce(_detail, '{}'::jsonb), coalesce(_rows, '[]'::jsonb),
            coalesce(_cards, '[]'::jsonb), coalesce(_is_demo, false))
    RETURNING id INTO _id;
  IF _audit_action IS NOT NULL THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
    SELECT _actor, _audit_action, 'onboarding_task', (r->>'taskId')::uuid, r->>'title', _reason, r->'before',
           (r->'after') || jsonb_build_object('batch_id', _id, 'batch_action', _action)
      FROM jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) r;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION private.plan_catch_up_claim_undo(_actor uuid, _batch uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE b public.onboarding_task_batches%ROWTYPE;
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'A signed-in teammate is required.'; END IF;
  SELECT * INTO b FROM public.onboarding_task_batches WHERE id = _batch FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That save was not found.'; END IF;
  IF b.actor IS DISTINCT FROM _actor AND NOT (public.has_role(_actor, 'admin') OR coalesce(public.is_onboarding_director(_actor), false)) THEN
    RAISE EXCEPTION 'Only the person who saved this, an Admin or the Director of Onboarding can undo it.';
  END IF;
  IF b.undone_at IS NOT NULL THEN RAISE EXCEPTION 'This was already undone.'; END IF;
  IF now() > b.undo_until THEN RAISE EXCEPTION 'Undo is available for 10 minutes. Change the Tasks one at a time instead.'; END IF;
  UPDATE public.onboarding_task_batches SET undone_at = now(), undone_by = _actor WHERE id = _batch;
  RETURN to_jsonb(b);
END $$;

CREATE OR REPLACE FUNCTION private.plan_catch_up_undo_done(_actor uuid, _batch uuid, _rows jsonb, _result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'A signed-in teammate is required.'; END IF;
  UPDATE public.onboarding_task_batches SET undo_result = _result WHERE id = _batch AND undone_by = _actor;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  SELECT _actor, 'onboarding_task_batch_undone', 'onboarding_task', (r->>'taskId')::uuid, r->>'title', r->'before',
         (r->'after') || jsonb_build_object('batch_id', _batch)
    FROM jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) r;
END $$;

REVOKE ALL ON FUNCTION private.plan_catch_up_gate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_can(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_bz_sent(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_owner_asked(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_person(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_state(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_cards(uuid, uuid, uuid[], text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_undo_extras(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_record(uuid, uuid, uuid, text, jsonb, jsonb, jsonb, boolean, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_claim_undo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.plan_catch_up_undo_done(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_gate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_can(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_bz_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_owner_asked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_person(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_state(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_cards(uuid, uuid, uuid[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_undo_extras(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_record(uuid, uuid, uuid, text, jsonb, jsonb, jsonb, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_claim_undo(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.plan_catch_up_undo_done(uuid, uuid, jsonb, jsonb) TO authenticated;

-- 4. Mark done: the existing Done before Resolve bulk complete, extended (same arguments).
-- Item 8 replaces O8's "nothing is completed until they are unticked": held Tasks are listed and
-- skipped, the rest save; each Task saves completely or not at all.
CREATE OR REPLACE FUNCTION public.bulk_complete_onboarding_tasks(_property_id uuid, _task_ids uuid[], _note text,
  _done_on date DEFAULT NULL::date, _file_task_id uuid DEFAULT NULL::uuid, _dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'private' AS $function$
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
      -- Cover first, so the completion never unlocks and sends these cards.
      _cards := private.plan_catch_up_cards(_actor, _property_id, ARRAY[s.id], 'done_outside_resolve', true);
      IF s.approve_outside THEN
        -- Approved outside Resolve (Earlier only): no approval request, owner item, notice or email.
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

-- 5. Not needed, Assign to, Change due date, Reopen: one call, each Task all or nothing, held Tasks listed.
CREATE OR REPLACE FUNCTION public.plan_catch_up_tasks(_property_id uuid, _task_ids uuid[], _action text,
  _reason text DEFAULT NULL, _role text DEFAULT NULL, _person uuid DEFAULT NULL, _due_on date DEFAULT NULL,
  _dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'private' AS $function$
DECLARE
  _actor uuid := auth.uid();
  _project public.onboarding_projects%ROWTYPE;
  _reason_clean text := btrim(COALESCE(_reason, ''));
  _can_reopen_any boolean;
  _held jsonb := '[]'::jsonb;
  _ready jsonb := '[]'::jsonb;
  _saved jsonb := '[]'::jsonb;
  _covered jsonb := '[]'::jsonb;
  _rows jsonb := '[]'::jsonb;
  _cards jsonb;
  _before jsonb;
  _n integer;
  _batch uuid;
  _prior text;
  _next text;
  s record;
  t public.onboarding_tasks%ROWTYPE;
BEGIN
  IF _actor IS NULL OR NOT private.plan_catch_up_gate(_actor) THEN
    RAISE EXCEPTION 'Only onboarding staff can update these Tasks.';
  END IF;
  IF _action NOT IN ('not_needed', 'assign', 'due_date', 'reopen') THEN RAISE EXCEPTION 'Choose what to change.'; END IF;
  _task_ids := COALESCE((SELECT array_agg(DISTINCT id) FROM unnest(_task_ids) ids(id)), '{}'::uuid[]);
  IF cardinality(_task_ids) = 0 THEN RAISE EXCEPTION 'Select at least one Task.'; END IF;
  IF cardinality(_task_ids) > 200 THEN RAISE EXCEPTION 'Select 200 Tasks or fewer at a time.'; END IF;
  IF NOT _dry_run THEN
    IF _action IN ('not_needed', 'reopen') AND char_length(_reason_clean) < 3 THEN
      RAISE EXCEPTION 'Add a reason (at least 3 characters).';
    END IF;
    IF _action = 'assign' AND ((_role IS NULL) = (_person IS NULL)) THEN RAISE EXCEPTION 'Choose one person or one role.'; END IF;
    IF _action = 'assign' AND _role IS NOT NULL AND _role <> ALL (ARRAY['onboarding_director', 'onboarding_manager',
       'onboarding_project_manager', 'utilities', 'lead_designer', 'designer', 'staging_team']) THEN
      RAISE EXCEPTION 'Choose an onboarding role.';
    END IF;
    IF _action = 'assign' AND _person IS NOT NULL AND NOT private.plan_catch_up_gate(_person) THEN
      RAISE EXCEPTION 'Choose someone on the onboarding team.';
    END IF;
    IF _action = 'due_date' AND _due_on IS NULL THEN RAISE EXCEPTION 'Pick a due date.'; END IF;
  END IF;

  SELECT * INTO _project FROM public.onboarding_projects
    WHERE property_id = _property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Start the onboarding project before changing its Tasks.'; END IF;
  IF private.onboarding_work_locked(ARRAY[_property_id]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked. Reopen a task with a reason instead.';
  END IF;
  -- Fix 17 stays: Admin, the Director of Onboarding, or the person who finished it reopens it.
  _can_reopen_any := public.has_role(_actor, 'admin') OR COALESCE(public.is_onboarding_director(_actor), false);

  PERFORM 1 FROM public.onboarding_tasks WHERE property_id = _property_id AND id = ANY(_task_ids) FOR UPDATE;
  DROP TABLE IF EXISTS pg_temp.plan_catch_up_selected;
  CREATE TEMPORARY TABLE plan_catch_up_selected ON COMMIT DROP AS
  SELECT ot.id, ot.title, ot.sort_order,
    CASE
      WHEN ot.archived_at IS NOT NULL THEN 'Already not needed.'
      WHEN ot.exception_at IS NOT NULL THEN 'Recorded as an exception.'
      WHEN NOT private.plan_catch_up_can(_actor, _project.project_manager, ot.assigned_to, ot.assigned_seat)
        THEN 'Not assigned to you or your role.'
      WHEN _action = 'reopen' AND ot.status IS DISTINCT FROM 'complete' THEN 'Not finished.'
      WHEN _action = 'reopen' AND NOT _can_reopen_any AND ot.completed_by IS DISTINCT FROM _actor
        THEN 'Only an Admin, the Director of Onboarding or the person who finished it can reopen it.'
      WHEN _action <> 'reopen' AND ot.status IN ('complete', 'done', 'carryover') THEN 'Already done. Reopen it first.'
      WHEN _action = 'not_needed' AND private.plan_catch_up_bz_sent(ot.id) THEN 'A Breezeway work order was already sent for it.'
      WHEN _action = 'not_needed' AND private.plan_catch_up_owner_asked(ot.id) THEN 'Already sent to the homeowner.'
      WHEN (SELECT e.new_value::jsonb->>'status' FROM public.onboarding_project_events e
            WHERE e.project_id = _project.id AND e.kind = 'stage_capture:' || ot.stage
            ORDER BY (e.new_value::jsonb->>'revision')::integer DESC LIMIT 1) IN ('complete', 'awaiting_review')
        THEN 'Its stage is under review or complete. Return or reopen the stage first.'
      ELSE NULL
    END AS held_reason
  FROM public.onboarding_tasks ot
  WHERE ot.property_id = _property_id AND ot.id = ANY(_task_ids);

  SELECT count(*) INTO _n FROM plan_catch_up_selected;
  IF _n <> cardinality(_task_ids) THEN
    RAISE EXCEPTION 'Some selected Tasks are not on this home''s plan. Refresh and try again.';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title, 'reason', held_reason) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _held FROM plan_catch_up_selected WHERE held_reason IS NOT NULL;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', id, 'title', title) ORDER BY sort_order, id), '[]'::jsonb)
    INTO _ready FROM plan_catch_up_selected WHERE held_reason IS NULL;

  IF _dry_run THEN
    RETURN jsonb_build_object('ready', _ready, 'held', _held, 'done', 0,
      'covered', CASE WHEN _action = 'not_needed' THEN private.plan_catch_up_cards(_actor, _property_id,
        COALESCE((SELECT array_agg(id) FROM plan_catch_up_selected WHERE held_reason IS NULL), '{}'::uuid[]),
        'task_not_needed', false) ELSE '[]'::jsonb END);
  END IF;

  FOR s IN SELECT * FROM plan_catch_up_selected WHERE held_reason IS NULL ORDER BY sort_order, id LOOP
    BEGIN
      SELECT * INTO t FROM public.onboarding_tasks WHERE id = s.id FOR UPDATE;
      _before := private.plan_catch_up_state(to_jsonb(t));
      _cards := '[]'::jsonb;
      IF _action = 'not_needed' THEN
        _cards := private.plan_catch_up_cards(_actor, _property_id, ARRAY[s.id], 'task_not_needed', true);
        -- The existing Void: kept on record, out of progress and overdue counts.
        UPDATE public.onboarding_tasks SET archived_at = now(), archived_by = _actor,
          exception_reason = 'Voided — not needed: ' || _reason_clean, exception_by = _actor, exception_at = now()
        WHERE id = s.id;
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_not_needed', 'Not needed for this home: "' || s.title || '"', _reason_clean,
                _actor, COALESCE(t.is_demo, false));
      ELSIF _action = 'assign' THEN
        _prior := CASE WHEN t.assigned_to IS NOT NULL THEN private.plan_catch_up_person(t.assigned_to)
                       ELSE COALESCE(t.assigned_seat, 'Unassigned') END;
        IF _role IS NOT NULL THEN
          -- Same as the home plan edit: the person then comes from whoever holds that role on this home.
          UPDATE public.onboarding_tasks SET assigned_seat = _role, assigned_to = NULL WHERE id = s.id;
          _next := _role;
        ELSE
          UPDATE public.onboarding_tasks SET assigned_to = _person WHERE id = s.id;
          _next := private.plan_catch_up_person(_person);
        END IF;
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, prior_value, new_value, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_assigned', 'Assigned "' || s.title || '"', _prior, _next, _actor, COALESCE(t.is_demo, false));
      ELSIF _action = 'due_date' THEN
        UPDATE public.onboarding_tasks SET due_on = _due_on, due_on_overridden = true, due_on_source = 'manual' WHERE id = s.id;
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, prior_value, new_value, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_due_changed', 'Due date changed: "' || s.title || '"',
                COALESCE(to_char(t.due_on, 'YYYY-MM-DD'), 'No due date'), to_char(_due_on, 'YYYY-MM-DD'), _actor, COALESCE(t.is_demo, false));
      ELSE
        -- Reopen keeps the earlier evidence on the Task, as the one-at-a-time Reopen does.
        UPDATE public.onboarding_tasks SET status = 'open' WHERE id = s.id;
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
        VALUES (_project.id, _property_id, 'task_reopened', 'Reopened "' || s.title || '"', _reason_clean,
                CASE WHEN t.completed_at IS NOT NULL THEN 'Completed ' || to_char(t.completed_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') ELSE 'Complete' END,
                'Open', _actor, COALESCE(t.is_demo, false));
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
    _batch := private.plan_catch_up_record(_actor, _property_id, _project.id, _action,
      jsonb_build_object('reason', NULLIF(_reason_clean, ''), 'role', _role, 'person', _person, 'due_on', _due_on),
      _rows, _covered, COALESCE(_project.is_demo, false),
      CASE _action WHEN 'not_needed' THEN 'onboarding_task_archived' WHEN 'assign' THEN 'onboarding_task_bulk_assigned'
                   WHEN 'due_date' THEN 'onboarding_task_bulk_due_changed' ELSE 'onboarding_task_reopened' END,
      NULLIF(_reason_clean, ''));
  END IF;
  RETURN jsonb_build_object('ready', _saved, 'held', _held, 'done', _n, 'batchId', _batch, 'covered', _covered);
END $function$;

-- 6. Undo within 10 minutes: restores exactly those Tasks (and the cards they covered) unless a Task changed since.
CREATE OR REPLACE FUNCTION public.undo_onboarding_task_batch(_batch_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'private' AS $function$
DECLARE
  _actor uuid := auth.uid();
  b jsonb;
  r jsonb;
  bf jsonb;
  t public.onboarding_tasks%ROWTYPE;
  _restored jsonb := '[]'::jsonb;
  _held jsonb := '[]'::jsonb;
  _rows jsonb := '[]'::jsonb;
  _cards integer := 0;
  _label text;
BEGIN
  IF _actor IS NULL OR NOT private.plan_catch_up_gate(_actor) THEN
    RAISE EXCEPTION 'Only onboarding staff can update these Tasks.';
  END IF;
  b := private.plan_catch_up_claim_undo(_actor, _batch_id);
  IF private.onboarding_work_locked(ARRAY[(b->>'property_id')::uuid]) THEN
    RAISE EXCEPTION 'Operations has this home, so onboarding tasks are locked.';
  END IF;
  _label := CASE b->>'action' WHEN 'mark_done' THEN 'Mark done' WHEN 'not_needed' THEN 'Not needed'
              WHEN 'assign' THEN 'Assign' WHEN 'due_date' THEN 'Change due date' ELSE 'Reopen' END;
  FOR r IN SELECT x FROM jsonb_array_elements(b->'task_rows') x LOOP
    BEGIN
      SELECT * INTO t FROM public.onboarding_tasks WHERE id = (r->>'taskId')::uuid FOR UPDATE;
      IF NOT FOUND OR t.updated_at IS DISTINCT FROM (r->'after'->>'updated_at')::timestamptz THEN
        RAISE EXCEPTION 'Changed since. Left as it is.';
      END IF;
      bf := r->'before';
      UPDATE public.onboarding_tasks SET
        owner_approval_status = bf->>'owner_approval_status',
        status = bf->>'status',
        completed_at = (bf->>'completed_at')::timestamptz,
        completed_by = (bf->>'completed_by')::uuid,
        evidence_note = bf->>'evidence_note',
        blocker = bf->>'blocker',
        archived_at = (bf->>'archived_at')::timestamptz,
        archived_by = (bf->>'archived_by')::uuid,
        exception_reason = bf->>'exception_reason',
        exception_by = (bf->>'exception_by')::uuid,
        exception_at = (bf->>'exception_at')::timestamptz,
        assigned_to = (bf->>'assigned_to')::uuid,
        assigned_seat = bf->>'assigned_seat',
        due_on = (bf->>'due_on')::date,
        due_on_overridden = COALESCE((bf->>'due_on_overridden')::boolean, false),
        due_on_source = bf->>'due_on_source'
      WHERE id = t.id;
      _cards := _cards + private.plan_catch_up_undo_extras(_actor, _batch_id, t.id);
      INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, actor, is_demo)
      VALUES ((b->>'project_id')::uuid, (b->>'property_id')::uuid, 'task_change_undone',
              'Undid ' || _label || ': "' || (r->>'title') || '"', NULL, _actor, COALESCE(t.is_demo, false));
      SELECT * INTO t FROM public.onboarding_tasks WHERE id = t.id;
      _rows := _rows || jsonb_build_array(jsonb_build_object('taskId', t.id, 'title', r->>'title',
        'before', r->'after', 'after', private.plan_catch_up_state(to_jsonb(t))));
      _restored := _restored || jsonb_build_array(jsonb_build_object('taskId', t.id, 'title', r->>'title'));
    EXCEPTION WHEN OTHERS THEN
      _held := _held || jsonb_build_array(jsonb_build_object('taskId', r->>'taskId', 'title', r->>'title', 'reason', SQLERRM));
    END;
  END LOOP;
  PERFORM private.plan_catch_up_undo_done(_actor, _batch_id, _rows,
    jsonb_build_object('restored', _restored, 'held', _held, 'cards', _cards));
  RETURN jsonb_build_object('restored', _restored, 'held', _held, 'cards', _cards, 'action', b->>'action');
END $function$;

REVOKE ALL ON FUNCTION public.plan_catch_up_tasks(uuid, uuid[], text, text, text, uuid, date, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_onboarding_task_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_catch_up_tasks(uuid, uuid[], text, text, text, uuid, date, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_onboarding_task_batch(uuid) TO authenticated, service_role;
