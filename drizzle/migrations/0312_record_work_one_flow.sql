-- Record work as one flow (Emily, Nov 7, 2026; register T8, T9, T10, T11).
-- Additive only. Undo: 01_undo_record_work.sql. No BEGIN/COMMIT.
--
-- 1. One touch saves go to the home's history (property_activity_log) with the
--    problem type and a one touch mark. No ticket, no clocks, no alerts.
-- 2. Repeat rule settings: app_settings key record_work_repeat
--    ({"times": 3, "days": 90}); never hardcoded in a function.
-- 3. home_problem_repeat / home_repeat_flags: counts by problem type per home
--    across tickets and one touch saves. Quiet Notion imports and archived
--    tickets never count.
-- 4. record_work_route_preview: the routing by time result in plain words
--    (who will do it), read from the same ticket_route_at the ticket trigger uses.
--    Returns a role kind and role name only, never a person.
-- 5. record_work_escalate: marks a just-created ticket escalated (existing
--    escalations row and ticket fields) and alerts the Operations Supervisor
--    through the existing notify_staff path. Ownership is unchanged.

ALTER TABLE public.property_activity_log
  ADD COLUMN problem_type_id uuid REFERENCES public.work_types(id) ON DELETE SET NULL,
  ADD COLUMN one_touch boolean NOT NULL DEFAULT false;

CREATE INDEX property_activity_log_problem_repeat
  ON public.property_activity_log (property_id, problem_type_id, occurred_at)
  WHERE problem_type_id IS NOT NULL;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('record_work_repeat', '{"times": 3, "days": 90}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.record_work_repeat_settings(OUT times int, OUT days int)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    greatest(1, coalesce((s.value->>'times')::int, 3)),
    greatest(1, coalesce((s.value->>'days')::int, 90))
  FROM (SELECT 1) one
  LEFT JOIN public.app_settings s ON s.key = 'record_work_repeat';
$function$;
REVOKE ALL ON FUNCTION private.record_work_repeat_settings() FROM PUBLIC, anon, authenticated;

-- Every counted occurrence of a problem type at a home: ordinary tickets and
-- one touch saves. A Notion import counts only once someone reopened or took it.
CREATE OR REPLACE FUNCTION private.home_problem_events(_since timestamptz)
 RETURNS TABLE(property_id uuid, work_type_id uuid, at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.property_id, t.work_type_id, t.reported_at
  FROM public.tickets t
  WHERE t.property_id IS NOT NULL
    AND t.work_type_id IS NOT NULL
    AND t.archived_at IS NULL
    AND t.reported_at >= _since
    AND (coalesce(t.external_source, '') <> 'notion' OR t.external_status = 'reopened_in_resolve')
  UNION ALL
  SELECT a.property_id, a.problem_type_id, a.occurred_at
  FROM public.property_activity_log a
  WHERE a.problem_type_id IS NOT NULL
    AND a.occurred_at >= _since;
$function$;
REVOKE ALL ON FUNCTION private.home_problem_events(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.home_problem_repeat(_property_id uuid, _work_type_id uuid)
 RETURNS TABLE(times_in_window int, times_needed int, window_days int, flagged boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _s record;
  _n int;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can read home history.';
  END IF;
  SELECT * INTO _s FROM private.record_work_repeat_settings();
  SELECT count(*)::int INTO _n
  FROM private.home_problem_events(now() - make_interval(days => _s.days)) e
  WHERE e.property_id = _property_id AND e.work_type_id = _work_type_id;
  times_in_window := _n;
  times_needed := _s.times;
  window_days := _s.days;
  flagged := _n >= _s.times;
  RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.home_problem_repeat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_problem_repeat(uuid, uuid) TO authenticated;

-- Repeat flags: one home (property page) or every home whose latest repeat is
-- on or after _since (the Operations Supervisor's weekly list).
CREATE OR REPLACE FUNCTION public.home_repeat_flags(_property_id uuid DEFAULT NULL, _since timestamptz DEFAULT NULL)
 RETURNS TABLE(property_id uuid, work_type_id uuid, problem_type text, times int, last_at timestamptz, window_days int, is_demo boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _s record;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can read home history.';
  END IF;
  SELECT * INTO _s FROM private.record_work_repeat_settings();
  RETURN QUERY
  SELECT e.property_id, e.work_type_id, wt.name, count(*)::int, max(e.at), _s.days, p.is_demo
  FROM private.home_problem_events(now() - make_interval(days => _s.days)) e
  JOIN public.work_types wt ON wt.id = e.work_type_id
  JOIN public.properties p ON p.id = e.property_id
  WHERE (_property_id IS NULL OR e.property_id = _property_id)
  GROUP BY e.property_id, e.work_type_id, wt.name, p.is_demo
  HAVING count(*) >= _s.times AND max(e.at) >= coalesce(_since, '-infinity'::timestamptz)
  ORDER BY max(e.at) DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.home_repeat_flags(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_repeat_flags(uuid, timestamptz) TO authenticated;

-- Who will do it, in plain words: the same routing by time the ticket trigger
-- runs (auto_assign_ticket -> ticket_route_at), as a role, never a person.
CREATE OR REPLACE FUNCTION public.record_work_route_preview(_work_type_id uuid)
 RETURNS TABLE(who_kind text, role_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can record work.';
  END IF;
  SELECT * INTO r FROM public.ticket_route_at(
    (SELECT wt.functional_role_code FROM public.work_types wt WHERE wt.id = _work_type_id),
    _work_type_id, now());
  IF r.user_id IS NULL THEN
    who_kind := 'nobody';
  ELSIF r.role_code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening') THEN
    who_kind := 'coordinator';
  ELSIF r.role_code IS NULL THEN
    who_kind := 'on_call';
  ELSIF r.role_code = 'ops_supervisor' THEN
    who_kind := 'supervisor';
  ELSE
    who_kind := 'role';
    SELECT fr.name INTO role_name FROM public.functional_roles fr WHERE fr.code = r.role_code;
  END IF;
  RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_work_route_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_work_route_preview(uuid) TO authenticated;

-- Escalate now (insurance risk): the person who just created the ticket marks it
-- escalated and the Operations Supervisor is told. Pressing it twice is safe.
CREATE OR REPLACE FUNCTION public.record_work_escalate(_ticket_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _t record;
  _id uuid;
  _supervisor uuid;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can escalate a ticket.';
  END IF;
  SELECT id, ref, title, property_id, is_demo, created_by, archived_at
    INTO _t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND OR _t.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'That ticket could not be found.';
  END IF;
  IF _t.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who recorded this ticket can escalate it here.';
  END IF;

  SELECT e.id INTO _id FROM public.escalations e
  WHERE e.ticket_id = _ticket_id AND e.status = 'open'
  ORDER BY e.created_at DESC LIMIT 1;
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  INSERT INTO public.escalations (
    ticket_id, property_id, escalated_by, escalated_to_role, reason, help_needed, urgency, is_demo
  ) VALUES (
    _ticket_id, _t.property_id, auth.uid(), 'supervisor',
    'This could be an insurance claim. Escalated before taking action.',
    'Decide what happens next. The team waits for your answer before acting.',
    'critical', _t.is_demo
  ) RETURNING id INTO _id;

  UPDATE public.tickets
  SET escalation_level = CASE WHEN escalation_level = 'none' THEN 'supervisor' ELSE escalation_level END,
      escalated_at = coalesce(escalated_at, now())
  WHERE id = _ticket_id;

  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, internal, body)
  VALUES (_ticket_id, auth.uid(), 'status', 'escalated', false,
    'Escalated to the Operations Supervisor: this could be an insurance claim. Ownership is unchanged.');

  _supervisor := public.seat_holder_at('ops_supervisor', now());
  PERFORM public.notify_staff(
    _supervisor, 'ticket_escalated',
    'Escalated: #' || _t.ref::text || ' ' || _t.title,
    'This could be an insurance claim. The team is waiting for your answer before acting.',
    'ticket', _ticket_id, '/tickets/' || _ticket_id::text, 'high', auth.uid(), true, _t.is_demo
  );

  RETURN _id;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_work_escalate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_work_escalate(uuid) TO authenticated;
