-- Undo for 01_manual_trackers.sql (Build 14). Puts back the Build 13 engine functions exactly,
-- removes the weekly job, the functions, the three tables and the settings. Run only with Emily's
-- approval. The tracker facts in scorecard_records are permanent and are not deleted; the kind
-- check is put back only when no records_check or records_check_review facts exist.
SELECT cron.unschedule('team-records-draw');
CREATE OR REPLACE FUNCTION private.bonus_facts(_key text, _user uuid, _from timestamptz, _to timestamptz,
                                               _plan text, _start date, _end date)
RETURNS TABLE (fact_key text, label text, at timestamptz, met boolean, score numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _today date := (_to AT TIME ZONE 'America/Chicago')::date;
BEGIN
  IF _key IN ('pc_follow_through', 'team_follow_through', 'team_reliability') THEN
    RETURN QUERY
    SELECT 'ticket:' || t.id || ':reply', coalesce(t.title, 'Ticket') || ': first reply', t.response_due_at,
           (t.acknowledged_at IS NOT NULL AND t.acknowledged_at <= t.response_due_at), NULL::numeric
      FROM public.tickets t
     WHERE NOT t.is_demo AND t.archived_at IS NULL AND coalesce(t.external_source, '') <> 'notion'
       AND coalesce(t.external_id, '') NOT LIKE 'arrival:%' AND coalesce(t.department_code, 'operations') = 'operations'
       AND t.response_due_at > _from AND t.response_due_at <= _to
       AND (_key <> 'pc_follow_through' OR t.assigned_to = _user)
    UNION ALL
    SELECT 'ticket:' || t.id || ':action', coalesce(t.title, 'Ticket') || ': real action', t.action_due_at,
           (t.action_started_at IS NOT NULL AND t.action_started_at <= t.action_due_at), NULL::numeric
      FROM public.tickets t
     WHERE NOT t.is_demo AND t.archived_at IS NULL AND coalesce(t.external_source, '') <> 'notion'
       AND coalesce(t.external_id, '') NOT LIKE 'arrival:%' AND coalesce(t.department_code, 'operations') = 'operations'
       AND t.action_due_at > _from AND t.action_due_at <= _to
       AND (_key <> 'pc_follow_through' OR t.assigned_to = _user)
    UNION ALL
    -- An arrival check nobody took also counts against the team's follow through (register BN10).
    SELECT 'arrival-unowned:' || (f.details ->> 'check_id'), 'Arrival check nobody took', f.recorded_at, false, NULL::numeric
      FROM public.scorecard_records f
     WHERE _key <> 'pc_follow_through' AND f.kind = 'arrival_check' AND NOT f.is_demo AND f.refers_to IS NULL
       AND f.details ->> 'also_counts_for' = 'ops_supervisor_team_follow_through'
       AND coalesce((f.details ->> 'counted')::boolean, false)
       AND f.recorded_at > _from AND f.recorded_at <= _to;
  END IF;

  IF _key IN ('pc_team_duties', 'team_reliability') THEN
    RETURN QUERY
    SELECT 'routine:' || r.id, 'Routine work: ' || coalesce(r.kind, 'check'), r.due_at,
           (r.completed_at IS NOT NULL AND r.completed_at <= r.due_at), NULL::numeric
      FROM public.routine_controls r
     WHERE NOT r.is_demo AND r.status <> 'cancelled' AND r.due_at > _from AND r.due_at <= _to
       AND (_key <> 'pc_team_duties' OR r.assigned_to = _user);
  END IF;

  IF _key = 'pc_shift_handoffs' THEN
    RETURN QUERY
    SELECT 'shift:' || s.role_code || ':' || s.day, 'Shift on ' || to_char(s.day, 'Mon FMDD'), s.end_at,
           EXISTS (SELECT 1 FROM public.shift_end_records e
                    WHERE e.user_id = _user AND NOT e.is_demo
                      AND e.ended_at >= s.start_at AND e.ended_at < s.end_at + interval '3 hours'
                      AND (e.nothing_to_hand_off OR coalesce(cardinality(e.handoff_ids), 0) > 0)), NULL::numeric
      FROM private.bonus_shifts(_user, private.bonus_pc_roles(), _from, _to) s;
  END IF;

  IF _key = 'queue_checks' THEN
    RETURN QUERY
    SELECT 'queue:' || s.day || ':' || w.n, w.name || ', ' || to_char(s.day, 'Mon FMDD'), w.w_end,
           EXISTS (SELECT 1 FROM public.scorecard_records q
                    WHERE q.kind = 'queue_sweep' AND q.recorded_by = _user AND NOT q.is_demo
                      AND q.details ->> 'source' = 'team_queue'
                      AND q.recorded_at >= w.w_start AND q.recorded_at <= w.w_end), NULL::numeric
      FROM private.bonus_shifts(_user, ARRAY['ops_supervisor'], _from, _to) s
      CROSS JOIN LATERAL (VALUES
        (1, 'Start of shift check', s.start_at, s.start_at + interval '30 minutes'),
        (2, 'Midpoint check', s.start_at + (s.end_at - s.start_at) / 2 - interval '30 minutes',
                              s.start_at + (s.end_at - s.start_at) / 2 + interval '30 minutes'),
        (3, 'End of shift check', s.end_at - interval '30 minutes', s.end_at)) w(n, name, w_start, w_end)
     WHERE w.w_end > _from AND w.w_end <= _to;
  END IF;

  IF _key = 'coaching' THEN
    RETURN QUERY
    SELECT 'coaching:' || p.user_id, 'Coaching for ' || coalesce(pr.full_name, 'a coordinator'), _to,
           EXISTS (SELECT 1 FROM public.scorecard_records c
                    WHERE c.kind = 'coaching_cycle' AND c.recorded_by = _user AND c.about_user_id = p.user_id
                      AND NOT c.is_demo AND c.recorded_at > _from AND c.recorded_at <= _to), NULL::numeric
      FROM public.bonus_participants p
      LEFT JOIN public.profiles pr ON pr.id = p.user_id
     WHERE p.plan_code = 'coordinator' AND p.active;
  END IF;

  IF _key = 'team_homes_ready' THEN
    RETURN QUERY
    SELECT 'arrival:' || c.id, c.home_label || ' arrival', c.check_in_at, c.result = 'on_time', NULL::numeric
      FROM public.arrival_checks c
     WHERE NOT c.is_test AND NOT c.late_booking AND c.cleared_at IS NULL AND c.result IN ('on_time', 'late', 'missed')
       AND c.check_in_at > _from AND c.check_in_at <= _to;
  END IF;

  IF _key = 'guest_rating' THEN
    RETURN QUERY
    SELECT 'stay:' || s.k, 'Stay ending ' || to_char(s.stay_end, 'Mon FMDD'), (s.stay_end::timestamp AT TIME ZONE 'America/Chicago'),
           NULL::boolean,
           round(CASE WHEN s.survey IS NOT NULL AND s.public IS NOT NULL THEN (s.survey + s.public) / 2
                      ELSE coalesce(s.survey, s.public) END, 3)
      FROM (SELECT coalesce(g.ownerrez_booking_id, 'feedback:' || g.id) AS k, max(g.stay_end) AS stay_end,
                   avg(g.rating) FILTER (WHERE g.source = 'resolve_survey') AS survey,
                   avg(g.rating) FILTER (WHERE g.source = 'ownerrez') AS public
              FROM public.guest_feedback g
             WHERE NOT g.is_demo AND g.rating IS NOT NULL AND g.source IN ('resolve_survey', 'ownerrez')
               AND g.stay_end >= (_from AT TIME ZONE 'America/Chicago')::date AND g.stay_end <= _today
             GROUP BY 1) s;
  END IF;

  IF _key = 'quarterly_priorities' THEN
    RETURN QUERY
    SELECT 'priority:' || p.id, p.name, p.updated_at,
           (p.status = 'result_agreed' AND p.accepted_on IS NOT NULL AND p.accepted_on + 30 <= least(_end, _today)
            AND nullif(btrim(coalesce(p.result_note, '')), '') IS NOT NULL),
           p.points::numeric
      FROM public.bonus_priorities p
     WHERE p.plan_code = _plan AND p.user_id = _user AND p.period_start = _start;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.bonus_measure_built(_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT _key IS NOT NULL AND _key NOT IN ('pc_clean_records', 'team_clean_records', 'weekly_report')
$$;

DROP FUNCTION IF EXISTS public.trackers_waiting();
DROP FUNCTION IF EXISTS public.manual_tracker_save_settings(text, jsonb);
DROP FUNCTION IF EXISTS public.weekly_scorecard_decide(date, boolean, text);
DROP FUNCTION IF EXISTS public.weekly_scorecard_submit(date, jsonb, text);
DROP FUNCTION IF EXISTS public.weekly_scorecard_save_draft(date, jsonb);
DROP FUNCTION IF EXISTS public.weekly_scorecard_weeks();
DROP FUNCTION IF EXISTS public.weekly_scorecard(date);
DROP FUNCTION IF EXISTS private.mt_current_due(timestamptz);
DROP FUNCTION IF EXISTS private.mt_weekly_status(date);
DROP FUNCTION IF EXISTS private.mt_weekly_met(date);
DROP FUNCTION IF EXISTS private.mt_weekly_events(date);
DROP FUNCTION IF EXISTS private.mt_weekly_facts(date);
DROP FUNCTION IF EXISTS private.mt_urgent(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.mt_count(text, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.coaching_log(date);
DROP FUNCTION IF EXISTS public.coaching_save_session(uuid, date, text, text[], text, text, jsonb, date);
DROP FUNCTION IF EXISTS private.mt_session_json(public.scorecard_records);
DROP FUNCTION IF EXISTS private.mt_session_on(public.scorecard_records);
DROP FUNCTION IF EXISTS public.team_records_mine();
DROP FUNCTION IF EXISTS public.team_records_double_check(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.team_records_skip(uuid, text);
DROP FUNCTION IF EXISTS public.team_records_review(uuid, boolean, jsonb, text, text);
DROP FUNCTION IF EXISTS public.team_records_weeks();
DROP FUNCTION IF EXISTS public.team_records_week(date);
DROP FUNCTION IF EXISTS private.mt_week_items(date, boolean);
DROP FUNCTION IF EXISTS private.mt_sweep(timestamptz);
DROP FUNCTION IF EXISTS private.mt_pick_checks(date);
DROP FUNCTION IF EXISTS private.mt_final_clean(uuid);
DROP FUNCTION IF EXISTS private.mt_review_of(uuid);
DROP FUNCTION IF EXISTS private.mt_draw_one(public.team_record_draws);
DROP FUNCTION IF EXISTS private.mt_draw(date);
DROP FUNCTION IF EXISTS private.mt_candidates(date);
DROP TABLE IF EXISTS public.weekly_scorecard_drafts;
DROP TABLE IF EXISTS public.team_record_check_picks;
DROP TABLE IF EXISTS public.team_record_draws;
DROP FUNCTION IF EXISTS private.mt_checklist_keys();
DROP FUNCTION IF EXISTS private.mt_monday(timestamptz);
DROP FUNCTION IF EXISTS private.mt_opens_at(date);
DROP FUNCTION IF EXISTS private.mt_due_at(date);
DROP FUNCTION IF EXISTS private.mt_first_due();
DROP FUNCTION IF EXISTS private.mt_coaching_required(uuid);
DROP FUNCTION IF EXISTS private.mt_setting(text);
DROP FUNCTION IF EXISTS private.mt_is_finance(uuid);
DROP FUNCTION IF EXISTS private.mt_can_set(uuid);
DROP FUNCTION IF EXISTS private.mt_is_lead(uuid);
DROP FUNCTION IF EXISTS private.mt_is_dir(uuid);
DROP FUNCTION IF EXISTS private.mt_is_sup(uuid);
DELETE FROM public.app_settings WHERE key IN ('team_records_settings', 'coaching_settings', 'weekly_scorecard_settings');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.scorecard_records WHERE kind IN ('records_check', 'records_check_review')) THEN
    ALTER TABLE public.scorecard_records DROP CONSTRAINT IF EXISTS scorecard_records_kind_check;
    ALTER TABLE public.scorecard_records ADD CONSTRAINT scorecard_records_kind_check CHECK (kind IN
      ('arrival_readiness', 'queue_sweep', 'coaching_cycle', 'weekly_submission', 'corrective_commitment',
       'finance_packet', 'arrival_check'));
  END IF;
END $$;
