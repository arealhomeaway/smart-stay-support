-- Record routine work: save a check and open its linked ticket in one step.
-- Staged only. Not applied until approved. Undo: 01_undo_record_routine.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
-- Additive: two new nullable/defaulted columns, one function, one trigger
-- function and one trigger. Nothing is dropped or rewritten.

-- 1. Where a saved check keeps its answers, and which review it was about.
ALTER TABLE public.routine_controls
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS guest_feedback_id uuid REFERENCES public.guest_feedback(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.routine_controls.answers IS
  'Answers from the Record routine work panel: steps, outcome, review reply fields, fix team.';

-- 2. Cleaning Review joins Checkout as retired: no new rows. History stays.
CREATE OR REPLACE FUNCTION private.refuse_new_retired_routine()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'cleaning_review' THEN
    RAISE EXCEPTION 'Cleaning Review checks are retired. The Departure Review in the Team Queue covers them.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.refuse_new_retired_routine() FROM PUBLIC;

CREATE TRIGGER routine_controls_no_new_retired BEFORE INSERT ON public.routine_controls
  FOR EACH ROW EXECUTE FUNCTION private.refuse_new_retired_routine();

-- 3. Save one check. Records who, when, the home and the answers. When an
--    issue is found it opens a ticket in the chosen team's queue (the work
--    type decides the team role, priority and clocks) and links both ways.
--    A second save of the same check returns the first result.
CREATE OR REPLACE FUNCTION public.record_routine_check(_check jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _kind text := _check->>'kind';
  _key text := nullif(btrim(coalesce(_check->>'event_key', '')), '');
  _outcome text := _check->>'outcome';
  _answers jsonb := coalesce(_check->'answers', '{}'::jsonb);
  _issue text := nullif(btrim(coalesce(_check->>'issue', '')), '');
  _fix_team text := _check->>'fix_team';
  _notes text := nullif(btrim(coalesce(_check->>'notes', '')), '');
  _link text := nullif(btrim(coalesce(_check->>'link', '')), '');
  _prop uuid := nullif(_check->>'property_id', '')::uuid;
  _feedback uuid := nullif(_check->>'feedback_id', '')::uuid;
  _row public.routine_controls;
  _found boolean;
  _demo boolean;
  _wt_name text;
  _wt public.work_types;
  _ticket uuid;
  _routine uuid;
  _now timestamptz := now();
BEGIN
  IF _me IS NULL OR NOT public.is_internal_staff(_me) THEN
    RAISE EXCEPTION 'Only staff can record routine work.' USING ERRCODE = '42501';
  END IF;
  IF _kind IN ('checkout', 'cleaning_review') THEN
    RAISE EXCEPTION 'This check is retired. The Departure Review in the Team Queue covers it.';
  END IF;
  IF _kind IS NULL OR _kind NOT IN ('guest_touch_base', 'maintenance_review', 'guest_review', 'survey_review') THEN
    RAISE EXCEPTION 'Choose a check.';
  END IF;
  IF _kind = 'survey_review'
     AND NOT coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'survey_review_check'), false) THEN
    RAISE EXCEPTION 'Survey reviews are not live yet.';
  END IF;
  IF _key IS NULL THEN RAISE EXCEPTION 'This check has no reference. Close the panel and try again.'; END IF;
  IF _outcome IS NULL OR _outcome NOT IN ('looks_good', 'needs_follow_up', 'no_answer', 'not_applicable')
     OR (_outcome = 'no_answer' AND _kind <> 'guest_touch_base') THEN
    RAISE EXCEPTION 'Choose how it went.';
  END IF;
  IF _kind = 'guest_review' AND _outcome <> 'not_applicable' THEN
    IF nullif(btrim(coalesce(_answers->>'reply_text', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Paste what we replied.';
    END IF;
    IF coalesce(_answers->>'posted_on', '') NOT IN ('airbnb', 'ownerrez', 'vrbo', 'booking_com', 'other') THEN
      RAISE EXCEPTION 'Choose where you posted it.';
    END IF;
    IF coalesce(_answers->>'repeat_issue', '') NOT IN ('no', 'yes') THEN
      RAISE EXCEPTION 'Answer whether this is a repeat issue at this home.';
    END IF;
  END IF;
  IF _outcome = 'needs_follow_up' THEN
    IF _issue IS NULL THEN RAISE EXCEPTION 'Say what needs fixing.'; END IF;
    IF coalesce(_fix_team, '') NOT IN ('guest_experience', 'property_operations') THEN
      RAISE EXCEPTION 'Choose which team should fix it.';
    END IF;
  END IF;

  SELECT * INTO _row FROM public.routine_controls WHERE kind = _kind AND event_key = _key FOR UPDATE;
  _found := FOUND;
  IF _found AND _row.status = 'completed' THEN
    RETURN jsonb_build_object('routine_id', _row.id, 'ticket_id', _row.follow_up_ticket_id, 'already_saved', true);
  END IF;
  IF _found AND _row.status = 'cancelled' THEN
    RAISE EXCEPTION 'This check was closed. Choose another one.';
  END IF;

  _prop := coalesce(CASE WHEN _found THEN _row.property_id END, _prop);
  _demo := CASE WHEN _found THEN _row.is_demo
                ELSE coalesce((SELECT p.is_demo FROM public.properties p WHERE p.id = _prop), false)
                     OR coalesce((_check->>'is_demo')::boolean, false) END;

  -- One rule: which ticket type a found issue opens, by check and team.
  IF _outcome = 'needs_follow_up' THEN
    _wt_name := CASE
      WHEN _kind = 'maintenance_review' AND _fix_team = 'property_operations' THEN 'Maintenance and landscaping work-order review'
      WHEN _kind IN ('guest_review', 'survey_review') AND _fix_team = 'guest_experience' THEN 'Guest review, survey and rating logs'
      WHEN _fix_team = 'guest_experience' THEN 'Current or past guest request'
      ELSE 'Ongoing maintenance'
    END;
    SELECT * INTO _wt FROM public.work_types WHERE name = _wt_name AND active LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The ticket type for this check is missing. Ask an Admin.';
    END IF;

    INSERT INTO public.tickets(
      title, description, property_id, work_type_id, functional_role_code, category, bucket,
      priority, suggested_priority, source_channel, record_type, entry_kind, status,
      reported_at, acknowledged_at, response_due_at, action_due_at, due_at,
      created_by, record_owner, accountable_owner, guest_name, guest_in_residence,
      linked_feedback_id, is_demo)
    VALUES (
      left(coalesce(nullif(btrim(_check->>'ticket_title'), ''), _issue), 200),
      coalesce(nullif(btrim(_check->>'ticket_description'), ''), _issue),
      _prop, _wt.id, _wt.functional_role_code, coalesce(_wt.category, 'other'), _wt.bucket,
      coalesce(_wt.default_priority, 'p3'), coalesce(_wt.default_priority, 'p3'), 'internal', 'active_task', 'ops', 'open',
      _now, _now,
      _now + make_interval(mins => coalesce(_wt.response_minutes, 120)),
      _now + make_interval(mins => coalesce(_wt.action_start_minutes, 480)),
      _now + make_interval(mins => coalesce(_wt.action_start_minutes, 480)),
      _me, _me, _me,
      coalesce(nullif(btrim(_check->>'guest_name'), ''), CASE WHEN _found THEN _row.guest_name END),
      _kind = 'guest_touch_base',
      CASE WHEN _kind = 'guest_review' THEN _feedback END,
      _demo)
    RETURNING id INTO _ticket;
  END IF;

  IF _found THEN
    UPDATE public.routine_controls SET
      status = 'completed', outcome = _outcome, findings = _issue,
      notes = coalesce(nullif(btrim(coalesce(_check->>'summary', '')), ''), _notes),
      answers = _answers, evidence_urls = CASE WHEN _link IS NULL THEN evidence_urls ELSE array_append(evidence_urls, _link) END,
      completed_by = _me, completed_at = _now, assigned_to = coalesce(assigned_to, _me),
      property_id = _prop, follow_up_ticket_id = coalesce(_ticket, follow_up_ticket_id),
      guest_feedback_id = coalesce(guest_feedback_id, _feedback)
    WHERE id = _row.id
    RETURNING id INTO _routine;
  ELSE
    INSERT INTO public.routine_controls(
      kind, event_key, property_id, title, guest_name, status, outcome, findings, notes, answers,
      evidence_urls, due_at, team, assigned_to, created_by, completed_by, completed_at,
      follow_up_ticket_id, guest_feedback_id, is_demo)
    VALUES (
      _kind, _key, _prop, left(coalesce(nullif(btrim(_check->>'title'), ''), 'Routine check'), 200),
      nullif(btrim(coalesce(_check->>'guest_name', '')), ''), 'completed', _outcome, _issue,
      coalesce(nullif(btrim(coalesce(_check->>'summary', '')), ''), _notes), _answers,
      CASE WHEN _link IS NULL THEN '{}'::text[] ELSE ARRAY[_link] END, _now,
      CASE WHEN _kind = 'maintenance_review' THEN 'property_operations' ELSE 'guest_experience' END,
      _me, _me, _me, _now, _ticket, _feedback, _demo)
    RETURNING id INTO _routine;
  END IF;

  IF _ticket IS NOT NULL THEN
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, internal, is_demo)
    VALUES (_ticket, _me, 'status', 'routine_follow_up',
            'Opened from a routine check so the issue is not lost.', true, _demo);
  END IF;

  RETURN jsonb_build_object('routine_id', _routine, 'ticket_id', _ticket, 'already_saved', false);
END $$;
REVOKE ALL ON FUNCTION public.record_routine_check(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_routine_check(jsonb) TO authenticated;
