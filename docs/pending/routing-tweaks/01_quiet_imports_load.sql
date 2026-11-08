-- Routing tweaks, part 1: quiet Notion imports never count towards anyone's load.
-- Staged only. Not applied until approved. Needs routing-by-time/03_coordinator_routing.sql first.
-- Undo: 01_undo_quiet_imports_load.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- Decision (Nov 8, 2026): an imported Notion ticket, assigned or not, adds nothing to a
-- coordinator's open work until someone takes or reopens it in Resolve (external_status
-- becomes 'reopened_in_resolve', the same rule the screens use). From then on it counts like
-- any other ticket. This is the same function as routing-by-time part 3 with that one line
-- added; who is on shift, lunch, the weights (Right now 5, Today 3, Routine 1), Waiting,
-- closed, archived and demo work, ties and rights are unchanged.

CREATE OR REPLACE FUNCTION public.coordinators_on_shift(_at timestamptz DEFAULT now())
RETURNS TABLE(user_id uuid, role_code text, team text, covering boolean, at_lunch boolean, load integer, last_given timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH l AS (
    SELECT EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int AS wd,
           (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
            + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int) AS m
  ), r AS (
    SELECT fr.code, fr.team,
           public.seat_holder_at(fr.code, _at) AS uid,
           coalesce((SELECT o.kind FROM public.seat_override_at(fr.code, _at) o) = 'cover', false) AS covering
    FROM public.functional_roles fr
    WHERE fr.active
      AND fr.code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening')
      AND public.seat_eligible_now(fr.code, _at)
  )
  SELECT r.uid, r.code, r.team, r.covering,
    EXISTS (
      SELECT 1 FROM public.coverage_shifts s, l
      WHERE s.role_code = r.code AND s.active AND s.weekday = l.wd
        AND s.lunch_start_minute IS NOT NULL
        AND l.m >= s.lunch_start_minute AND l.m < s.lunch_end_minute),
    coalesce((
      SELECT sum(CASE t.priority WHEN 'p1' THEN 5 WHEN 'p2' THEN 3 ELSE 1 END)
      FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.status NOT IN ('resolved', 'closed', 'waiting')
        AND t.archived_at IS NULL
        AND NOT coalesce(t.is_demo, false)
        AND NOT (t.external_source IS NOT DISTINCT FROM 'notion'
                 AND t.external_status IS DISTINCT FROM 'reopened_in_resolve')), 0)::int,
    (SELECT max(t.created_at) FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.assignment_source IN ('automatic', 'breezeway_auto_route'))
  FROM r
  WHERE public.staff_assignable(r.uid)
$$;
REVOKE ALL ON FUNCTION public.coordinators_on_shift(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coordinators_on_shift(timestamptz) TO service_role;
