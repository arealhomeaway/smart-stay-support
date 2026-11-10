-- Build 13: the bonus engine, My bonus, the verify chain and the Finance view (Emily, Nov 10;
-- register BN5, BN6, BN11). Values and scoring rules: docs/specs/bonus-guide-values.md (A to D, F).
-- Additive only: new tables, new functions and one hourly job. The scorecard capture tables and
-- every existing function, policy, clock, alert and routing rule are read, never changed.
-- Undo: undo/01_bonus_engine.sql. No BEGIN/COMMIT.

-- 1. Who is who. Leaders are the COO, the CEO and Admin.
CREATE OR REPLACE FUNCTION private.bonus_is_leader(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _u IS NOT NULL AND (private.has_role(_u, 'admin') OR private.sc_holds(_u, 'coo') OR private.sc_holds(_u, 'ceo'))
$$;
CREATE OR REPLACE FUNCTION public.bonus_is_leader(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$ SELECT private.bonus_is_leader(_u) $$;
CREATE OR REPLACE FUNCTION private.bonus_pc_roles() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['po_day', 'po_evening', 'ge_day', 'ge_evening', 'ge_parttime', 'property_coordinator']
$$;

-- 2. Settings tables. Every change goes through a function below and is logged.
CREATE TABLE public.bonus_plans (
  code text PRIMARY KEY CHECK (code IN ('ops_supervisor', 'director_ops', 'coordinator')),
  name text NOT NULL,
  position int NOT NULL,
  period_kind text NOT NULL CHECK (period_kind IN ('monthly', 'quarterly')),
  counting_start date NOT NULL,
  reviewer_role text NOT NULL,
  reviewer_name text NOT NULL,
  amount_goal_met numeric(10,2),
  amount_strong numeric(10,2),
  amount_exceeds numeric(10,2),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bonus_period_amounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL REFERENCES public.bonus_plans(code),
  period_start date NOT NULL,
  period_end date NOT NULL,
  label text NOT NULL,
  amount_goal_met numeric(10,2) NOT NULL,
  amount_strong numeric(10,2) NOT NULL,
  amount_exceeds numeric(10,2) NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_code, period_start),
  CHECK (period_end >= period_start)
);
CREATE TABLE public.bonus_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL REFERENCES public.bonus_plans(code),
  position int NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  share numeric(5,2) NOT NULL CHECK (share >= 0 AND share <= 100),
  unit text NOT NULL CHECK (unit IN ('percent', 'rating', 'points')),
  threshold_met numeric(8,3) NOT NULL,
  threshold_strong numeric(8,3) NOT NULL,
  threshold_exceeds numeric(8,3) NOT NULL,
  source text NOT NULL CHECK (source IN ('automatic', 'reviewer')),
  measure_key text,
  how_measured text,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_code, code),
  CHECK (threshold_met <= threshold_strong AND threshold_strong <= threshold_exceeds),
  CHECK (source = 'reviewer' OR measure_key IS NOT NULL)
);
CREATE TABLE public.bonus_goal_thresholds (
  goal_id uuid NOT NULL REFERENCES public.bonus_goals(id),
  applies_from date NOT NULL,
  threshold_met numeric(8,3) NOT NULL,
  threshold_strong numeric(8,3) NOT NULL,
  threshold_exceeds numeric(8,3) NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, applies_from),
  CHECK (threshold_met <= threshold_strong AND threshold_strong <= threshold_exceeds)
);
CREATE TABLE public.bonus_participants (
  user_id uuid NOT NULL,
  plan_code text NOT NULL REFERENCES public.bonus_plans(code),
  eligible_from date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plan_code)
);
CREATE TABLE public.bonus_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL DEFAULT 'director_ops' REFERENCES public.bonus_plans(code),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  name text NOT NULL,
  points int NOT NULL CHECK (points >= 0 AND points <= 100),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'in_use', 'result_agreed')),
  accepted_on date,
  result_note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bonus_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  row_key text NOT NULL,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 3. Periods, the reviewer's entries and the verify history.
CREATE TABLE public.bonus_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL REFERENCES public.bonus_plans(code),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'verified')),
  ready_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  notified_at timestamptz,
  reminded_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  version int NOT NULL DEFAULT 0,
  snapshot jsonb,
  total numeric(10,2),
  UNIQUE (plan_code, user_id, period_start)
);
CREATE TABLE public.bonus_period_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.bonus_periods(id),
  version int NOT NULL,
  action text NOT NULL CHECK (action IN ('verified', 'reopened')),
  reason text,
  snapshot jsonb,
  total numeric(10,2),
  done_by uuid NOT NULL,
  done_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.bonus_manual_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.bonus_goals(id),
  value numeric(10,3),
  note text NOT NULL,
  evidence_url text,
  entered_by uuid NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.bonus_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.bonus_goals(id),
  kind text NOT NULL CHECK (kind IN ('excused', 'system_problem')),
  fact_key text,
  reason text NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  decision text CHECK (decision IN ('approved', 'declined')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  CHECK (kind = 'system_problem' OR fact_key IS NOT NULL)
);
CREATE TABLE public.bonus_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.bonus_periods(id),
  question text NOT NULL,
  raised_by uuid NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  answer text,
  answered_by uuid,
  answered_at timestamptz
);
CREATE INDEX bonus_manual_measures_lookup ON public.bonus_manual_measures (plan_code, user_id, period_start, goal_id, entered_at DESC);
CREATE INDEX bonus_adjustments_lookup ON public.bonus_adjustments (plan_code, user_id, period_start);

GRANT SELECT ON public.bonus_plans, public.bonus_period_amounts, public.bonus_goals, public.bonus_goal_thresholds,
  public.bonus_participants, public.bonus_priorities, public.bonus_settings_history, public.bonus_periods,
  public.bonus_period_history, public.bonus_manual_measures, public.bonus_adjustments, public.bonus_questions TO authenticated;
GRANT ALL ON public.bonus_plans, public.bonus_period_amounts, public.bonus_goals, public.bonus_goal_thresholds,
  public.bonus_participants, public.bonus_priorities, public.bonus_settings_history, public.bonus_periods,
  public.bonus_period_history, public.bonus_manual_measures, public.bonus_adjustments, public.bonus_questions TO service_role;

ALTER TABLE public.bonus_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_period_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_goal_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_period_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_manual_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_questions ENABLE ROW LEVEL SECURITY;

-- Only the COO, the CEO and Admin read the tables directly; everyone else reads through the
-- checked functions below, which return only what that person may see.
CREATE POLICY bonus_plans_leaders ON public.bonus_plans FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_period_amounts_leaders ON public.bonus_period_amounts FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_goals_leaders ON public.bonus_goals FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_goal_thresholds_leaders ON public.bonus_goal_thresholds FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_participants_leaders ON public.bonus_participants FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_priorities_leaders ON public.bonus_priorities FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_settings_history_leaders ON public.bonus_settings_history FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_periods_leaders ON public.bonus_periods FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_period_history_leaders ON public.bonus_period_history FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_manual_measures_leaders ON public.bonus_manual_measures FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_adjustments_leaders ON public.bonus_adjustments FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));
CREATE POLICY bonus_questions_leaders ON public.bonus_questions FOR SELECT TO authenticated USING (public.bonus_is_leader(auth.uid()));

-- History never changes.
CREATE OR REPLACE FUNCTION private.bonus_block_history_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Bonus history is kept as it was written.';
END $$;
CREATE TRIGGER bonus_settings_history_keep BEFORE UPDATE OR DELETE ON public.bonus_settings_history
  FOR EACH ROW EXECUTE FUNCTION private.bonus_block_history_change();
CREATE TRIGGER bonus_period_history_keep BEFORE UPDATE OR DELETE ON public.bonus_period_history
  FOR EACH ROW EXECUTE FUNCTION private.bonus_block_history_change();
CREATE TRIGGER bonus_manual_measures_keep BEFORE UPDATE OR DELETE ON public.bonus_manual_measures
  FOR EACH ROW EXECUTE FUNCTION private.bonus_block_history_change();

-- 4. Seeds: every number from the Notion Operations Bonus Guides (bonus-guide-values.md B, C, D).
INSERT INTO public.bonus_plans (code, name, position, period_kind, counting_start, reviewer_role, reviewer_name,
                                amount_goal_met, amount_strong, amount_exceeds) VALUES
  ('ops_supervisor', 'Operations Supervisor', 1, 'monthly', '2026-11-16', 'director_ops', 'Director of Operations', 100, 137.50, 175),
  ('director_ops', 'Director of Operations', 2, 'quarterly', '2026-11-16', 'coo', 'COO', 750, 937.50, 1125),
  ('coordinator', 'Property Coordinator', 3, 'monthly', '2027-01-01', 'ops_supervisor', 'Operations Supervisor', 50, 75, 100);
INSERT INTO public.bonus_period_amounts (plan_code, period_start, period_end, label, amount_goal_met, amount_strong, amount_exceeds) VALUES
  ('ops_supervisor', '2026-11-09', '2026-11-30', 'November 2026', 73.33, 100.83, 128.33),
  ('director_ops', '2026-11-09', '2026-12-31', 'Pilot, Nov 9 to Dec 31, 2026', 434.43, 543.03, 651.64);

INSERT INTO public.bonus_goals (plan_code, position, code, name, share, unit, threshold_met, threshold_strong, threshold_exceeds,
                                source, measure_key, how_measured, active) VALUES
  ('coordinator', 1, 'follow_through', 'On time follow through', 30, 'percent', 95, 96.5, 98, 'automatic', 'pc_follow_through',
   'First replies and real action on your tickets done by their deadline. Urgent means a reply within 3 minutes and real action within 5.', true),
  ('coordinator', 2, 'clean_records', 'Clean records', 25, 'percent', 90, 92.5, 95, 'automatic', 'pc_clean_records',
   'Your records checked as clean, divided by your records reviewed.', true),
  ('coordinator', 3, 'shift_handoffs', 'Shift handoffs', 20, 'percent', 95, 97.5, 100, 'automatic', 'pc_shift_handoffs',
   'Shifts that ended with a handoff or Nothing to hand off.', true),
  ('coordinator', 4, 'team_duties', 'Team duties on time', 15, 'percent', 95, 97.5, 100, 'automatic', 'pc_team_duties',
   'Routine checks you own done by their due time.', true),
  ('coordinator', 5, 'homes_ready', 'Homes ready for guests', 10, 'percent', 95, 96.5, 98, 'automatic', 'team_homes_ready',
   'One team score: arrival checks done on time, divided by eligible arrivals for the whole team.', true),
  ('ops_supervisor', 1, 'team_follow_through', 'Team on time follow through', 30, 'percent', 95, 96.5, 98, 'automatic', 'team_follow_through',
   'Ticket deadlines met across the whole team, added together.', true),
  ('ops_supervisor', 2, 'queue_checks', 'Queue checks', 25, 'percent', 95, 97.5, 100, 'automatic', 'queue_checks',
   'Three checks each shift: within 30 minutes of starting, at the midpoint and within 30 minutes of ending. Clocked when you open the Team Queue or All unclaimed.', true),
  ('ops_supervisor', 3, 'team_clean_records', 'Team clean records', 20, 'percent', 90, 92.5, 95, 'automatic', 'team_clean_records',
   'Records checked as clean, divided by records checked, across every coordinator.', true),
  ('ops_supervisor', 4, 'coaching', 'Monthly coaching', 15, 'percent', 90, 95, 100, 'automatic', 'coaching',
   'One coaching session with each coordinator each month. Onboarding coaching counts.', true),
  ('ops_supervisor', 5, 'weekly_report', 'Weekly report on time', 10, 'percent', 90, 95, 100, 'automatic', 'weekly_report',
   'The weekly scorecard reaches the Director of Operations by Thursday 3 PM Central, covering work through Wednesday, and is accurate.', true),
  ('director_ops', 1, 'guest_rating', 'Guest rating', 20, 'rating', 4.81, 4.83, 4.85, 'automatic', 'guest_rating',
   'Average guest rating out of 5, one score per stay. A survey and a public review on the same stay are averaged. Needs at least 30 rated stays.', true),
  ('director_ops', 2, 'guest_issues_fixed', 'Guest issues fixed on time', 15, 'percent', 90, 95, 100, 'reviewer', NULL,
   'Fix plans for 1 to 3 star reviews and repeat problems finished by their original deadline. Entered by the COO until fix plan records exist.', true),
  ('director_ops', 3, 'team_reliability', 'Team reliability', 20, 'percent', 95, 96.5, 98, 'automatic', 'team_reliability',
   'Team on time follow through and team duties on time, combined.', true),
  ('director_ops', 4, 'finance_packets', 'Finance packets every Friday', 10, 'percent', 95, 96.5, 98, 'reviewer', NULL,
   'Under review: the weekly Friday finance packet was retired. Not counted until a replacement is decided.', false),
  ('director_ops', 5, 'quarterly_priorities', 'Quarterly priorities', 20, 'points', 80, 90, 100, 'automatic', 'quarterly_priorities',
   'Points of priorities that were accepted, used for 30 days and have an agreed result.', true),
  ('director_ops', 6, 'vendor_coverage', 'Vendor coverage', 15, 'percent', 80, 90, 100, 'reviewer', NULL,
   '48 slots: 6 markets, each with a primary and a backup Approved or Gold vendor in HVAC, plumbing, handyman and electrical. Entered by the COO until the coverage records mark primary and backup.', true);

INSERT INTO public.bonus_goal_thresholds (goal_id, applies_from, threshold_met, threshold_strong, threshold_exceeds)
SELECT g.id, v.applies_from, v.met, v.strong, v.exceeds
  FROM public.bonus_goals g
  CROSS JOIN (VALUES ('2026-11-09'::date, 4.81, 4.83, 4.85), ('2027-01-01'::date, 4.85, 4.875, 4.90),
                     ('2027-04-01'::date, 4.91, 4.93, 4.95)) v(applies_from, met, strong, exceeds)
 WHERE g.plan_code = 'director_ops' AND g.code = 'guest_rating';

-- People on a plan: today's role holders. Eligibility dates are per person and edited on the settings page.
INSERT INTO public.bonus_participants (user_id, plan_code, eligible_from)
SELECT DISTINCT r.current_seat_holder, 'ops_supervisor', '2026-11-16'::date
  FROM public.functional_roles r WHERE r.code = 'ops_supervisor' AND r.active AND r.current_seat_holder IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.bonus_participants (user_id, plan_code, eligible_from)
SELECT DISTINCT r.current_seat_holder, 'director_ops', '2026-11-16'::date
  FROM public.functional_roles r WHERE r.code = 'director_ops' AND r.active AND r.current_seat_holder IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.bonus_participants (user_id, plan_code, eligible_from)
SELECT DISTINCT r.current_seat_holder, 'coordinator',
       CASE WHEN r.code = 'po_evening' THEN '2027-01-10'::date ELSE '2027-01-01'::date END
  FROM public.functional_roles r
 WHERE r.code = ANY (private.bonus_pc_roles()) AND r.active AND r.current_seat_holder IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Periods and their dollar amounts.
CREATE OR REPLACE FUNCTION private.bonus_period(_plan text, _day date)
RETURNS TABLE (period_start date, period_end date, label text, amount_goal_met numeric, amount_strong numeric, amount_exceeds numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  p public.bonus_plans;
  o public.bonus_period_amounts;
  _s date;
BEGIN
  SELECT * INTO p FROM public.bonus_plans WHERE code = _plan;
  IF NOT FOUND OR _day IS NULL THEN RETURN; END IF;
  SELECT * INTO o FROM public.bonus_period_amounts a
   WHERE a.plan_code = _plan AND _day BETWEEN a.period_start AND a.period_end
   ORDER BY a.period_start DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT o.period_start, o.period_end, o.label, o.amount_goal_met, o.amount_strong, o.amount_exceeds;
    RETURN;
  END IF;
  IF _day < p.counting_start THEN RETURN; END IF;
  IF p.period_kind = 'monthly' THEN
    _s := date_trunc('month', _day)::date;
    RETURN QUERY SELECT _s, ((_s + interval '1 month')::date - 1), to_char(_s, 'FMMonth YYYY'),
                        p.amount_goal_met, p.amount_strong, p.amount_exceeds;
  ELSE
    _s := date_trunc('quarter', _day)::date;
    RETURN QUERY SELECT _s, ((_s + interval '3 months')::date - 1),
                        'Q' || extract(quarter FROM _s)::int || ' ' || extract(year FROM _s)::int,
                        p.amount_goal_met, p.amount_strong, p.amount_exceeds;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.bonus_pays_on(_end date) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT 'The last payday in ' || to_char((_end + interval '1 day')::date, 'FMMonth YYYY')
$$;

CREATE OR REPLACE FUNCTION private.bonus_question_closes(_verified timestamptz) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT ((public.add_business_days((_verified AT TIME ZONE 'America/Chicago')::date, 3) + 1)::timestamp
          AT TIME ZONE 'America/Chicago')
$$;

-- 6. Scheduled shifts (Central time), from the team schedule and today's role holders.
CREATE OR REPLACE FUNCTION private.bonus_shifts(_user uuid, _roles text[], _from timestamptz, _to timestamptz)
RETURNS TABLE (role_code text, day date, start_at timestamptz, end_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT x.role_code, x.day, x.start_at, x.end_at FROM (
    SELECT s.role_code, d::date AS day,
           ((d::date + s.start_minute * interval '1 minute') AT TIME ZONE 'America/Chicago') AS start_at,
           ((d::date + (CASE WHEN s.end_minute <= s.start_minute THEN s.end_minute + 1440 ELSE s.end_minute END)
                       * interval '1 minute') AT TIME ZONE 'America/Chicago') AS end_at
      FROM generate_series((_from AT TIME ZONE 'America/Chicago')::date - 1, (_to AT TIME ZONE 'America/Chicago')::date,
                           interval '1 day') d
      JOIN public.coverage_shifts s ON s.active AND s.weekday = extract(dow FROM d)::int AND s.role_code = ANY (_roles)
      JOIN public.functional_roles r ON r.code = s.role_code AND r.current_seat_holder = _user
  ) x
  WHERE x.end_at > _from AND x.end_at <= _to
$$;

-- 7. The facts behind each automatic measure. One row per thing that was due.
--    Never counted: demo and test records, imported Notion tickets, archived tickets, anything
--    before the person's counting start, and records the COO excused.
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

-- Measures that come from records Resolve does not keep yet (Build 14).
CREATE OR REPLACE FUNCTION private.bonus_measure_built(_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT _key IS NOT NULL AND _key NOT IN ('pc_clean_records', 'team_clean_records', 'weekly_report')
$$;

-- 8. The engine. One rule for every screen, the verify step and Finance (bonus-guide-values.md A).
CREATE OR REPLACE FUNCTION private.bonus_compute(_plan text, _user uuid, _start date, _now timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  p public.bonus_plans;
  per record;
  part public.bonus_participants;
  g public.bonus_goals;
  _count_from date;
  _from timestamptz;
  _to timestamptz;
  _period_to timestamptz;
  _excluded text[];
  _met numeric; _strong numeric; _exc numeric;
  _status text; _value numeric; _num int; _den int; _level text; _facts jsonb; _note text; _evidence text;
  _sys boolean; _manual record; _facts_n int;
  _goals jsonb := '[]'::jsonb;
  _counted_share numeric := 0;
  _counted int := 0;
  _total numeric := 0;
  _item jsonb;
  _out jsonb := '[]'::jsonb;
  _amount numeric;
  _eff numeric;
BEGIN
  SELECT * INTO p FROM public.bonus_plans WHERE code = _plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'This bonus plan was not found.'; END IF;
  SELECT * INTO per FROM private.bonus_period(_plan, _start);
  IF per.period_start IS DISTINCT FROM _start THEN RAISE EXCEPTION 'This bonus period was not found.'; END IF;
  SELECT * INTO part FROM public.bonus_participants WHERE user_id = _user AND plan_code = _plan;
  _count_from := greatest(per.period_start, p.counting_start, coalesce(part.eligible_from, p.counting_start));
  _from := (_count_from::timestamp AT TIME ZONE 'America/Chicago');
  _period_to := ((per.period_end + 1)::timestamp AT TIME ZONE 'America/Chicago');
  _to := least(_period_to, _now);
  SELECT coalesce(array_agg(a.fact_key), ARRAY[]::text[]) INTO _excluded
    FROM public.bonus_adjustments a
   WHERE a.plan_code = _plan AND a.user_id = _user AND a.period_start = _start
     AND a.kind = 'excused' AND a.decision = 'approved';

  FOR g IN SELECT * FROM public.bonus_goals WHERE plan_code = _plan ORDER BY position, name LOOP
    SELECT t.threshold_met, t.threshold_strong, t.threshold_exceeds INTO _met, _strong, _exc
      FROM public.bonus_goal_thresholds t WHERE t.goal_id = g.id AND t.applies_from <= per.period_start
     ORDER BY t.applies_from DESC LIMIT 1;
    IF NOT FOUND THEN _met := g.threshold_met; _strong := g.threshold_strong; _exc := g.threshold_exceeds; END IF;
    _status := NULL; _value := NULL; _num := NULL; _den := NULL; _level := NULL; _facts := '[]'::jsonb;
    _note := NULL; _evidence := NULL; _facts_n := 0;
    _sys := EXISTS (SELECT 1 FROM public.bonus_adjustments a
                     WHERE a.plan_code = _plan AND a.user_id = _user AND a.period_start = _start AND a.goal_id = g.id
                       AND a.kind = 'system_problem' AND a.decision = 'approved');
    SELECT m.value, m.note, m.evidence_url, m.entered_at INTO _manual
      FROM public.bonus_manual_measures m
     WHERE m.plan_code = _plan AND m.user_id = _user AND m.period_start = _start AND m.goal_id = g.id
     ORDER BY m.entered_at DESC LIMIT 1;

    IF NOT g.active THEN
      _status := 'inactive';
    ELSIF _now < _from THEN
      _status := 'not_started';
    ELSIF g.source = 'reviewer' OR NOT private.bonus_measure_built(g.measure_key) THEN
      IF _manual.entered_at IS NULL THEN
        _status := CASE WHEN g.source = 'reviewer' THEN 'waiting_entry' ELSE 'not_tracked' END;
      ELSIF _manual.value IS NULL THEN
        _status := 'nothing_to_measure'; _note := _manual.note; _evidence := _manual.evidence_url;
      ELSE
        _status := 'counted'; _value := _manual.value; _note := _manual.note; _evidence := _manual.evidence_url;
      END IF;
    ELSE
      SELECT count(*) FILTER (WHERE NOT (f.fact_key = ANY (_excluded))),
             count(*) FILTER (WHERE f.met AND NOT (f.fact_key = ANY (_excluded))),
             CASE WHEN g.measure_key = 'guest_rating' THEN round(avg(f.score) FILTER (WHERE NOT (f.fact_key = ANY (_excluded))), 3)
                  WHEN g.measure_key = 'quarterly_priorities' THEN coalesce(sum(f.score) FILTER (WHERE f.met AND NOT (f.fact_key = ANY (_excluded))), 0)
                  ELSE NULL END,
             coalesce(jsonb_agg(jsonb_build_object('key', f.fact_key, 'label', f.label, 'at', f.at, 'met', f.met,
                                                   'score', f.score, 'excused', f.fact_key = ANY (_excluded))
                                ORDER BY f.at DESC), '[]'::jsonb)
        INTO _den, _num, _value, _facts
        FROM private.bonus_facts(g.measure_key, _user, _from, _to, _plan, _start, per.period_end) f;
      _facts_n := jsonb_array_length(_facts);
      IF jsonb_array_length(_facts) > 200 THEN
        _facts := (SELECT jsonb_agg(e) FROM (SELECT e FROM jsonb_array_elements(_facts) e LIMIT 200) x);
      END IF;
      IF g.measure_key = 'guest_rating' THEN
        IF _den < 30 THEN _status := 'not_enough'; _value := NULL; ELSE _status := 'counted'; END IF;
      ELSIF _den = 0 THEN
        _status := 'no_data';
      ELSIF g.measure_key = 'quarterly_priorities' THEN
        _status := 'counted';
      ELSE
        _status := 'counted';
        _value := round(_num * 100.0 / _den, 2);
      END IF;
    END IF;

    IF _status = 'counted' THEN
      _level := CASE WHEN _value >= _exc THEN 'exceeds' WHEN _value >= _strong THEN 'strong'
                     WHEN _value >= _met THEN 'goal_met' ELSE 'below' END;
      -- A system problem the COO approved counts at Goal met or the actual level, whichever is higher.
      IF _sys AND _level = 'below' THEN _level := 'goal_met'; END IF;
      _counted := _counted + 1;
      _counted_share := _counted_share + g.share;
    ELSIF _sys AND _status IN ('no_data', 'not_enough') THEN
      _status := 'counted'; _level := 'goal_met';
      _counted := _counted + 1;
      _counted_share := _counted_share + g.share;
    END IF;

    _goals := _goals || jsonb_build_array(jsonb_build_object(
      'goal_id', g.id, 'code', g.code, 'name', g.name, 'how_measured', g.how_measured, 'share', g.share, 'unit', g.unit,
      'source', g.source, 'active', g.active, 'threshold_met', _met, 'threshold_strong', _strong, 'threshold_exceeds', _exc,
      'status', _status, 'value', _value, 'numerator', _num, 'denominator', _den, 'level', _level,
      'system_problem', _sys, 'note', _note, 'evidence_url', _evidence, 'facts', _facts, 'fact_count', _facts_n));
  END LOOP;

  FOR _item IN SELECT * FROM jsonb_array_elements(_goals) LOOP
    _eff := NULL; _amount := NULL;
    IF _item ->> 'status' = 'counted' AND _counted_share > 0 THEN
      _eff := round((_item ->> 'share')::numeric * 100 / _counted_share, 4);
      IF _counted >= 3 THEN
        _amount := CASE _item ->> 'level' WHEN 'exceeds' THEN per.amount_exceeds WHEN 'strong' THEN per.amount_strong
                                          WHEN 'goal_met' THEN per.amount_goal_met ELSE 0 END;
        -- The total adds the exact amounts and is rounded once, so no cent is lost to rounding.
        _total := _total + coalesce((_item ->> 'share')::numeric * _amount / _counted_share, 0);
        _amount := round((_item ->> 'share')::numeric * _amount / _counted_share, 2);
      END IF;
    END IF;
    _out := _out || jsonb_build_array(_item || jsonb_build_object('effective_share', _eff, 'dollars', _amount));
  END LOOP;

  IF _now < _from THEN
    _total := NULL;
  ELSIF _counted < 3 THEN
    -- Fewer than 3 goals could be measured: the full Goal met amount for the period.
    _total := per.amount_goal_met;
  ELSE
    _total := round(least(_total, per.amount_exceeds), 2);
  END IF;

  RETURN jsonb_build_object(
    'plan', _plan, 'plan_name', p.name, 'user_id', _user, 'reviewer_name', p.reviewer_name,
    'period_start', per.period_start, 'period_end', per.period_end, 'label', per.label,
    'counting_from', _count_from, 'closed', _now >= _period_to, 'pays_on', private.bonus_pays_on(per.period_end),
    'amount_goal_met', per.amount_goal_met, 'amount_strong', per.amount_strong, 'amount_exceeds', per.amount_exceeds,
    'goals', _out, 'counted_goals', _counted, 'fewer_than_three', _now >= _from AND _counted < 3,
    'total', _total, 'data_as_of', _now);
END $$;

-- 9. Who may see a person's bonus: the person (a coordinator only from their start date), their
--    reviewer, and the COO, the CEO and Admin. Nobody else.
CREATE OR REPLACE FUNCTION private.bonus_can_view(_me uuid, _user uuid, _plan text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _me IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bonus_participants bp JOIN public.bonus_plans p ON p.code = bp.plan_code
     WHERE bp.user_id = _user AND bp.plan_code = _plan
       AND (private.bonus_is_leader(_me)
            OR (_me <> _user AND private.sc_holds(_me, p.reviewer_role))
            OR (_me = _user AND bp.active
                AND (bp.plan_code <> 'coordinator'
                     OR (now() AT TIME ZONE 'America/Chicago')::date >= greatest(bp.eligible_from, p.counting_start)))))
$$;
CREATE OR REPLACE FUNCTION private.bonus_is_reviewer(_me uuid, _user uuid, _plan text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _me IS NOT NULL AND _me <> _user
     AND EXISTS (SELECT 1 FROM public.bonus_plans p WHERE p.code = _plan AND private.sc_holds(_me, p.reviewer_role))
$$;

-- 10. My bonus and the reviewer's lists.
CREATE OR REPLACE FUNCTION public.bonus_my_plans()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  IF _me IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'plan', p.code, 'plan_name', p.name, 'counting_start', greatest(p.counting_start, bp.eligible_from),
             'current_start', (SELECT x.period_start FROM private.bonus_period(p.code, greatest(_today, greatest(p.counting_start, bp.eligible_from))) x),
             'periods', coalesce((SELECT jsonb_agg(jsonb_build_object('period_start', bpr.period_start, 'label', bpr.label, 'status', bpr.status)
                                                   ORDER BY bpr.period_start DESC)
                                    FROM public.bonus_periods bpr WHERE bpr.plan_code = p.code AND bpr.user_id = _me), '[]'::jsonb))
             ORDER BY p.position)
      FROM public.bonus_participants bp JOIN public.bonus_plans p ON p.code = bp.plan_code
     WHERE bp.user_id = _me AND bp.active AND private.bonus_can_view(_me, _me, p.code)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.bonus_people()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  IF _me IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'plan', p.code, 'plan_name', p.name, 'user_id', bp.user_id, 'name', coalesce(pr.full_name, 'Team member'),
             'active', bp.active, 'eligible_from', bp.eligible_from, 'is_reviewer', private.bonus_is_reviewer(_me, bp.user_id, p.code),
             'current_start', (SELECT x.period_start FROM private.bonus_period(p.code, greatest(_today, greatest(p.counting_start, bp.eligible_from))) x),
             'periods', coalesce((SELECT jsonb_agg(jsonb_build_object('period_start', bpr.period_start, 'label', bpr.label,
                                                                      'status', bpr.status, 'total', CASE WHEN bpr.status = 'verified' THEN bpr.total END)
                                                   ORDER BY bpr.period_start DESC)
                                    FROM public.bonus_periods bpr WHERE bpr.plan_code = p.code AND bpr.user_id = bp.user_id), '[]'::jsonb))
             ORDER BY p.position, pr.full_name)
      FROM public.bonus_participants bp
      JOIN public.bonus_plans p ON p.code = bp.plan_code
      LEFT JOIN public.profiles pr ON pr.id = bp.user_id
     WHERE bp.user_id <> _me AND private.bonus_can_view(_me, bp.user_id, p.code)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.bonus_my_reviews()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('plan', b.plan_code, 'plan_name', p.name, 'user_id', b.user_id,
                                               'period_start', b.period_start, 'label', b.label, 'ready_at', b.ready_at)
                            ORDER BY b.ready_at), '[]'::jsonb)
    FROM public.bonus_periods b JOIN public.bonus_plans p ON p.code = b.plan_code
   WHERE b.status = 'ready' AND private.bonus_is_reviewer(auth.uid(), b.user_id, b.plan_code)
$$;

-- One person's bonus for one period: the locked numbers once verified, otherwise live.
CREATE OR REPLACE FUNCTION public.bonus_scorecard(_plan text, _user uuid, _start date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  b public.bonus_periods;
  _card jsonb;
  _closes timestamptz;
  _reviewer boolean;
BEGIN
  IF NOT private.bonus_can_view(_me, _user, _plan) THEN
    RAISE EXCEPTION 'You cannot see this bonus.';
  END IF;
  SELECT * INTO b FROM public.bonus_periods WHERE plan_code = _plan AND user_id = _user AND period_start = _start;
  IF b.status = 'verified' THEN
    _card := b.snapshot;
    _closes := private.bonus_question_closes(b.verified_at);
  ELSE
    _card := private.bonus_compute(_plan, _user, _start, now());
  END IF;
  _reviewer := private.bonus_is_reviewer(_me, _user, _plan);
  RETURN _card || jsonb_build_object(
    'status', CASE WHEN b.status = 'verified' THEN 'verified' WHEN b.id IS NOT NULL THEN 'ready' ELSE 'in_progress' END,
    'verified_at', b.verified_at, 'verified_by_name', (SELECT full_name FROM public.profiles WHERE id = b.verified_by),
    'version', coalesce(b.version, 0), 'person_name', (SELECT full_name FROM public.profiles WHERE id = _user),
    'question_window_closes', _closes,
    'can_raise_question', coalesce(_me = _user AND b.status = 'verified' AND now() <= _closes, false),
    'can_verify', coalesce(_reviewer AND b.id IS NOT NULL AND b.status = 'ready', false),
    'can_enter', coalesce(_reviewer AND coalesce(b.status, 'ready') <> 'verified', false),
    'can_reopen', coalesce((_reviewer OR private.bonus_is_leader(_me)) AND _me <> _user AND b.status = 'verified', false),
    'can_decide', coalesce(private.sc_holds(_me, 'coo') AND _me <> _user, false),
    'adjustments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'goal_id', a.goal_id, 'kind', a.kind, 'fact_key', a.fact_key,
                                                                 'reason', a.reason, 'decision', a.decision, 'decision_note', a.decision_note,
                                                                 'requested_at', a.requested_at, 'decided_at', a.decided_at) ORDER BY a.requested_at)
                               FROM public.bonus_adjustments a
                              WHERE a.plan_code = _plan AND a.user_id = _user AND a.period_start = _start), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'raised_at', q.raised_at,
                                                               'answer', q.answer, 'answered_at', q.answered_at) ORDER BY q.raised_at)
                             FROM public.bonus_questions q WHERE q.period_id = b.id), '[]'::jsonb),
    'history', CASE WHEN _me = _user AND NOT private.bonus_is_leader(_me) THEN '[]'::jsonb ELSE
                 coalesce((SELECT jsonb_agg(jsonb_build_object('action', h.action, 'version', h.version, 'reason', h.reason,
                                                               'total', h.total, 'done_at', h.done_at) ORDER BY h.done_at)
                             FROM public.bonus_period_history h WHERE h.period_id = b.id), '[]'::jsonb) END);
END $$;

-- 11. The reviewer's tools. Only the person's reviewer, never the person, and never once verified.
CREATE OR REPLACE FUNCTION private.bonus_assert_open(_plan text, _user uuid, _start date) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.bonus_is_reviewer(auth.uid(), _user, _plan) THEN
    RAISE EXCEPTION 'Only this person''s reviewer can do this.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bonus_periods WHERE plan_code = _plan AND user_id = _user AND period_start = _start
                AND status = 'verified') THEN
    RAISE EXCEPTION 'This period is verified. Reopen it with a reason first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.bonus_period(_plan, _start) x WHERE x.period_start = _start) THEN
    RAISE EXCEPTION 'This bonus period was not found.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_enter_measure(_plan text, _user uuid, _start date, _goal uuid,
                                                      _value numeric, _note text, _evidence_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  g public.bonus_goals;
  _id uuid;
BEGIN
  PERFORM private.bonus_assert_open(_plan, _user, _start);
  SELECT * INTO g FROM public.bonus_goals WHERE id = _goal AND plan_code = _plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'This goal was not found.'; END IF;
  IF g.source = 'automatic' AND private.bonus_measure_built(g.measure_key) THEN
    RAISE EXCEPTION 'This goal is counted from Resolve records. Excuse a record or flag a system problem instead.';
  END IF;
  IF length(btrim(coalesce(_note, ''))) < 3 THEN RAISE EXCEPTION 'Add a note about where the number comes from.'; END IF;
  IF _value IS NOT NULL AND _value < 0 THEN RAISE EXCEPTION 'Enter a number of zero or more.'; END IF;
  INSERT INTO public.bonus_manual_measures (plan_code, user_id, period_start, goal_id, value, note, evidence_url, entered_by)
  VALUES (_plan, _user, _start, _goal, _value, btrim(_note), nullif(btrim(coalesce(_evidence_url, '')), ''), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_request_adjustment(_plan text, _user uuid, _start date, _goal uuid,
                                                           _kind text, _fact_key text, _reason text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _id uuid;
  _coo uuid;
BEGIN
  PERFORM private.bonus_assert_open(_plan, _user, _start);
  IF _kind NOT IN ('excused', 'system_problem') THEN RAISE EXCEPTION 'Choose excuse a record or system problem.'; END IF;
  IF _kind = 'excused' AND nullif(btrim(coalesce(_fact_key, '')), '') IS NULL THEN RAISE EXCEPTION 'Choose the record to excuse.'; END IF;
  IF length(btrim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'Write the reason.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bonus_goals WHERE id = _goal AND plan_code = _plan) THEN
    RAISE EXCEPTION 'This goal was not found.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bonus_adjustments WHERE plan_code = _plan AND user_id = _user AND period_start = _start
                AND goal_id = _goal AND kind = _kind AND coalesce(fact_key, '') = coalesce(_fact_key, '') AND decision IS NULL) THEN
    RAISE EXCEPTION 'This is already waiting for the COO.';
  END IF;
  INSERT INTO public.bonus_adjustments (plan_code, user_id, period_start, goal_id, kind, fact_key, reason, requested_by)
  VALUES (_plan, _user, _start, _goal, _kind, CASE WHEN _kind = 'excused' THEN btrim(_fact_key) END, btrim(_reason), auth.uid())
  RETURNING id INTO _id;
  _coo := public.seat_holder_at('coo', now());
  IF _coo IS NOT NULL AND _coo <> auth.uid() THEN
    PERFORM public.notify_staff(_coo, 'bonus_adjustment', 'A bonus record is waiting for your approval',
      'Open Bonus verify to approve or decline it.', 'bonus_adjustment', _id, '/bonus-verify', NULL, auth.uid(), false, false);
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_decide_adjustment(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  a public.bonus_adjustments;
BEGIN
  IF NOT private.sc_holds(auth.uid(), 'coo') THEN RAISE EXCEPTION 'Only the COO approves this.'; END IF;
  SELECT * INTO a FROM public.bonus_adjustments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF a.user_id = auth.uid() THEN RAISE EXCEPTION 'Nobody approves their own bonus.'; END IF;
  IF a.decision IS NOT NULL THEN RAISE EXCEPTION 'This was already decided.'; END IF;
  IF EXISTS (SELECT 1 FROM public.bonus_periods WHERE plan_code = a.plan_code AND user_id = a.user_id
                AND period_start = a.period_start AND status = 'verified') THEN
    RAISE EXCEPTION 'This period is verified. Reopen it with a reason first.';
  END IF;
  UPDATE public.bonus_adjustments
     SET decision = CASE WHEN _approve THEN 'approved' ELSE 'declined' END,
         decision_note = nullif(btrim(coalesce(_note, '')), ''), decided_by = auth.uid(), decided_at = clock_timestamp()
   WHERE id = _id;
END $$;

-- 12. Verify, reopen, and the person's question.
CREATE OR REPLACE FUNCTION public.bonus_verify(_plan text, _user uuid, _start date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  b public.bonus_periods;
  per record;
  _card jsonb;
  _waiting text;
  _me uuid := auth.uid();
BEGIN
  IF NOT private.bonus_is_reviewer(_me, _user, _plan) THEN
    RAISE EXCEPTION 'Only this person''s reviewer can verify. Nobody verifies their own.';
  END IF;
  SELECT * INTO per FROM private.bonus_period(_plan, _start);
  IF per.period_start IS DISTINCT FROM _start THEN RAISE EXCEPTION 'This bonus period was not found.'; END IF;
  IF now() < ((per.period_end + 1)::timestamp AT TIME ZONE 'America/Chicago') THEN
    RAISE EXCEPTION 'This period has not ended yet.';
  END IF;
  INSERT INTO public.bonus_periods (plan_code, user_id, period_start, period_end, label)
  VALUES (_plan, _user, _start, per.period_end, per.label)
  ON CONFLICT (plan_code, user_id, period_start) DO NOTHING;
  SELECT * INTO b FROM public.bonus_periods WHERE plan_code = _plan AND user_id = _user AND period_start = _start FOR UPDATE;
  IF b.status = 'verified' THEN RAISE EXCEPTION 'This period is already verified.'; END IF;
  IF EXISTS (SELECT 1 FROM public.bonus_adjustments WHERE plan_code = _plan AND user_id = _user AND period_start = _start
                AND decision IS NULL) THEN
    RAISE EXCEPTION 'A request is still waiting for the COO.';
  END IF;
  _card := private.bonus_compute(_plan, _user, _start, now());
  SELECT string_agg(e ->> 'name', ', ') INTO _waiting FROM jsonb_array_elements(_card -> 'goals') e
   WHERE e ->> 'status' = 'waiting_entry';
  IF _waiting IS NOT NULL THEN
    RAISE EXCEPTION 'Enter %, or mark it Nothing to measure, first.', _waiting;
  END IF;
  UPDATE public.bonus_periods
     SET status = 'verified', verified_by = _me, verified_at = clock_timestamp(), version = version + 1,
         snapshot = _card, total = (_card ->> 'total')::numeric
   WHERE id = b.id
   RETURNING * INTO b;
  INSERT INTO public.bonus_period_history (period_id, version, action, snapshot, total, done_by)
  VALUES (b.id, b.version, 'verified', _card, b.total, _me);
  PERFORM public.notify_staff(_user, 'bonus_verified', 'Your bonus for ' || b.label || ' is verified',
    'Open My scorecard to see it. You have 3 business days to raise a question.', 'bonus_period', b.id, '/my-scorecard',
    NULL, _me, true, false);
  RETURN jsonb_build_object('period_id', b.id, 'total', b.total, 'version', b.version);
END $$;

CREATE OR REPLACE FUNCTION public.bonus_reopen(_plan text, _user uuid, _start date, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  b public.bonus_periods;
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL OR _me = _user OR NOT (private.bonus_is_reviewer(_me, _user, _plan) OR private.bonus_is_leader(_me)) THEN
    RAISE EXCEPTION 'Only the reviewer, the COO, the CEO or Admin can reopen this.';
  END IF;
  IF length(btrim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'Write why it is changing.'; END IF;
  SELECT * INTO b FROM public.bonus_periods WHERE plan_code = _plan AND user_id = _user AND period_start = _start FOR UPDATE;
  IF NOT FOUND OR b.status <> 'verified' THEN RAISE EXCEPTION 'This period is not verified.'; END IF;
  INSERT INTO public.bonus_period_history (period_id, version, action, reason, snapshot, total, done_by)
  VALUES (b.id, b.version, 'reopened', btrim(_reason), b.snapshot, b.total, _me);
  UPDATE public.bonus_periods
     SET status = 'ready', verified_by = NULL, verified_at = NULL, snapshot = NULL, total = NULL,
         ready_at = clock_timestamp(), reminded_at = NULL
   WHERE id = b.id;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_raise_question(_plan text, _start date, _question text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  b public.bonus_periods;
  p public.bonus_plans;
  _id uuid;
  _rev uuid;
  _coo uuid;
BEGIN
  SELECT * INTO b FROM public.bonus_periods WHERE plan_code = _plan AND user_id = auth.uid() AND period_start = _start;
  IF NOT FOUND OR b.status <> 'verified' THEN RAISE EXCEPTION 'You can raise a question once your bonus is verified.'; END IF;
  IF now() > private.bonus_question_closes(b.verified_at) THEN
    RAISE EXCEPTION 'The 3 business days to raise a question have passed.';
  END IF;
  IF length(btrim(coalesce(_question, ''))) < 5 THEN RAISE EXCEPTION 'Write your question.'; END IF;
  INSERT INTO public.bonus_questions (period_id, question, raised_by) VALUES (b.id, btrim(_question), auth.uid())
  RETURNING id INTO _id;
  SELECT * INTO p FROM public.bonus_plans WHERE code = _plan;
  _rev := public.seat_holder_at(p.reviewer_role, now());
  IF _rev IS NOT NULL AND _rev <> auth.uid() THEN
    PERFORM public.notify_staff(_rev, 'bonus_question', 'A question about the ' || b.label || ' bonus for ' || p.name,
      'Open Bonus verify to answer it.', 'bonus_question', _id, '/bonus-verify', NULL, auth.uid(), true, false);
  END IF;
  -- The COO settles questions about the Operations Supervisor.
  _coo := public.seat_holder_at('coo', now());
  IF _plan = 'ops_supervisor' AND _coo IS NOT NULL AND _coo IS DISTINCT FROM _rev THEN
    PERFORM public.notify_staff(_coo, 'bonus_question', 'A question about the ' || b.label || ' bonus for ' || p.name,
      'Open Bonus verify to see it.', 'bonus_question', _id, '/bonus-verify', NULL, auth.uid(), true, false);
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_answer_question(_id uuid, _answer text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  q public.bonus_questions;
  b public.bonus_periods;
BEGIN
  SELECT * INTO q FROM public.bonus_questions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This question was not found.'; END IF;
  SELECT * INTO b FROM public.bonus_periods WHERE id = q.period_id;
  IF NOT (private.bonus_is_reviewer(auth.uid(), b.user_id, b.plan_code)
          OR (private.sc_holds(auth.uid(), 'coo') AND auth.uid() <> b.user_id)) THEN
    RAISE EXCEPTION 'Only the reviewer or the COO answers this.';
  END IF;
  IF length(btrim(coalesce(_answer, ''))) < 3 THEN RAISE EXCEPTION 'Write the answer.'; END IF;
  UPDATE public.bonus_questions SET answer = btrim(_answer), answered_by = auth.uid(), answered_at = clock_timestamp()
   WHERE id = _id;
  PERFORM public.notify_staff(b.user_id, 'bonus_question_answered', 'Your bonus question has an answer',
    'Open My scorecard to read it.', 'bonus_question', _id, '/my-scorecard', NULL, auth.uid(), false, false);
END $$;

-- 13. Finance: verified amounts only. Unverified rows show Waiting and no amount, for everyone.
CREATE OR REPLACE FUNCTION public.bonus_payouts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF NOT (private.bonus_is_leader(_me) OR public.is_finance_lead(_me)) THEN
    RAISE EXCEPTION 'Only Finance, the COO, the CEO and Admin see bonus payouts.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', b.id, 'plan', b.plan_code, 'plan_name', p.name, 'user_id', b.user_id,
             'person', coalesce(pr.full_name, 'Team member'), 'period_start', b.period_start, 'period_end', b.period_end,
             'label', b.label, 'status', b.status, 'pays_on', private.bonus_pays_on(b.period_end),
             'total', CASE WHEN b.status = 'verified' THEN b.total END,
             'verified_at', CASE WHEN b.status = 'verified' THEN b.verified_at END,
             'verified_by', CASE WHEN b.status = 'verified' THEN (SELECT full_name FROM public.profiles WHERE id = b.verified_by) END,
             'goals', CASE WHEN b.status = 'verified' THEN
                        (SELECT jsonb_agg(jsonb_build_object('name', e ->> 'name', 'value', e -> 'value', 'unit', e ->> 'unit',
                                                             'status', e ->> 'status', 'level', e ->> 'level', 'dollars', e -> 'dollars'))
                           FROM jsonb_array_elements(b.snapshot -> 'goals') e)
                      ELSE '[]'::jsonb END)
             ORDER BY b.period_start DESC, p.position, pr.full_name)
      FROM public.bonus_periods b
      JOIN public.bonus_plans p ON p.code = b.plan_code
      LEFT JOIN public.profiles pr ON pr.id = b.user_id), '[]'::jsonb);
END $$;

-- 14. Settings: the COO, the CEO and Admin. Every change records who, when and the old value.
CREATE OR REPLACE FUNCTION private.bonus_log(_area text, _key text, _field text, _old jsonb, _new jsonb, _reason text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, private AS $$
  INSERT INTO public.bonus_settings_history (area, row_key, field, old_value, new_value, reason, changed_by)
  SELECT _area, _key, _field, _old, _new, nullif(btrim(coalesce(_reason, '')), ''), auth.uid()
   WHERE _old IS DISTINCT FROM _new
$$;
CREATE OR REPLACE FUNCTION private.bonus_assert_leader() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.bonus_is_leader(auth.uid()) THEN
    RAISE EXCEPTION 'Only the COO, the CEO or Admin can change bonus settings.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_settings()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  PERFORM private.bonus_assert_leader();
  RETURN jsonb_build_object(
    'plans', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.position), '[]'::jsonb) FROM public.bonus_plans p),
    'period_amounts', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.plan_code, a.period_start), '[]'::jsonb) FROM public.bonus_period_amounts a),
    'goals', (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.plan_code, g.position), '[]'::jsonb) FROM public.bonus_goals g),
    'thresholds', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.goal_id, t.applies_from), '[]'::jsonb) FROM public.bonus_goal_thresholds t),
    'participants', (SELECT coalesce(jsonb_agg(to_jsonb(bp) || jsonb_build_object('name', coalesce(pr.full_name, 'Team member'))
                                                ORDER BY bp.plan_code, pr.full_name), '[]'::jsonb)
                       FROM public.bonus_participants bp LEFT JOIN public.profiles pr ON pr.id = bp.user_id),
    'priorities', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.period_start, x.name), '[]'::jsonb) FROM public.bonus_priorities x),
    'history', (SELECT coalesce(jsonb_agg(to_jsonb(h) || jsonb_build_object('by_name', pr.full_name) ORDER BY h.changed_at DESC), '[]'::jsonb)
                  FROM (SELECT * FROM public.bonus_settings_history ORDER BY changed_at DESC LIMIT 300) h
                  LEFT JOIN public.profiles pr ON pr.id = h.changed_by));
END $$;

CREATE OR REPLACE FUNCTION public.bonus_save_plan(_code text, _counting_start date, _met numeric, _strong numeric,
                                                  _exceeds numeric, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  p public.bonus_plans;
BEGIN
  PERFORM private.bonus_assert_leader();
  SELECT * INTO p FROM public.bonus_plans WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This bonus plan was not found.'; END IF;
  IF _counting_start IS NULL THEN RAISE EXCEPTION 'Choose the date counting starts.'; END IF;
  IF _met IS NOT NULL AND (_met < 0 OR _strong < _met OR _exceeds < _strong) THEN
    RAISE EXCEPTION 'Amounts must rise from Goal met to Strong to Exceeds.';
  END IF;
  PERFORM private.bonus_log('plan', _code, 'counting_start', to_jsonb(p.counting_start), to_jsonb(_counting_start), _reason);
  PERFORM private.bonus_log('plan', _code, 'amount_goal_met', to_jsonb(p.amount_goal_met), to_jsonb(_met), _reason);
  PERFORM private.bonus_log('plan', _code, 'amount_strong', to_jsonb(p.amount_strong), to_jsonb(_strong), _reason);
  PERFORM private.bonus_log('plan', _code, 'amount_exceeds', to_jsonb(p.amount_exceeds), to_jsonb(_exceeds), _reason);
  UPDATE public.bonus_plans SET counting_start = _counting_start, amount_goal_met = _met, amount_strong = _strong,
         amount_exceeds = _exceeds, updated_by = auth.uid(), updated_at = now()
   WHERE code = _code;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_save_period_amounts(_plan text, _start date, _end date, _label text,
                                                            _met numeric, _strong numeric, _exceeds numeric, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  o public.bonus_period_amounts;
BEGIN
  PERFORM private.bonus_assert_leader();
  IF _start IS NULL OR _end IS NULL OR _end < _start THEN RAISE EXCEPTION 'Choose the first and last day.'; END IF;
  IF length(btrim(coalesce(_label, ''))) < 3 THEN RAISE EXCEPTION 'Name the period.'; END IF;
  IF _met IS NULL OR _met < 0 OR _strong < _met OR _exceeds < _strong THEN
    RAISE EXCEPTION 'Amounts must rise from Goal met to Strong to Exceeds.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bonus_periods WHERE plan_code = _plan AND period_start = _start AND status = 'verified') THEN
    RAISE EXCEPTION 'This period has a verified bonus. Reopen it first.';
  END IF;
  SELECT * INTO o FROM public.bonus_period_amounts WHERE plan_code = _plan AND period_start = _start;
  PERFORM private.bonus_log('period_amounts', _plan || ':' || _start, 'amounts',
    CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('end', o.period_end, 'label', o.label, 'goal_met', o.amount_goal_met,
                                                               'strong', o.amount_strong, 'exceeds', o.amount_exceeds) END,
    jsonb_build_object('end', _end, 'label', btrim(_label), 'goal_met', _met, 'strong', _strong, 'exceeds', _exceeds), _reason);
  INSERT INTO public.bonus_period_amounts (plan_code, period_start, period_end, label, amount_goal_met, amount_strong,
                                           amount_exceeds, updated_by)
  VALUES (_plan, _start, _end, btrim(_label), _met, _strong, _exceeds, auth.uid())
  ON CONFLICT (plan_code, period_start) DO UPDATE
    SET period_end = EXCLUDED.period_end, label = EXCLUDED.label, amount_goal_met = EXCLUDED.amount_goal_met,
        amount_strong = EXCLUDED.amount_strong, amount_exceeds = EXCLUDED.amount_exceeds,
        updated_by = EXCLUDED.updated_by, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.bonus_save_goal(_id uuid, _plan text, _name text, _share numeric, _unit text,
                                                  _met numeric, _strong numeric, _exceeds numeric, _source text,
                                                  _active boolean, _how text DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  g public.bonus_goals;
  _new uuid;
BEGIN
  PERFORM private.bonus_assert_leader();
  IF length(btrim(coalesce(_name, ''))) < 3 THEN RAISE EXCEPTION 'Name the goal.'; END IF;
  IF _share IS NULL OR _share < 0 OR _share > 100 THEN RAISE EXCEPTION 'The share is a percent from 0 to 100.'; END IF;
  IF _unit NOT IN ('percent', 'rating', 'points') THEN RAISE EXCEPTION 'Choose percent, rating or points.'; END IF;
  IF _met IS NULL OR _strong IS NULL OR _exceeds IS NULL OR _strong < _met OR _exceeds < _strong THEN
    RAISE EXCEPTION 'Targets must rise from Goal met to Strong to Exceeds.';
  END IF;
  IF _source NOT IN ('automatic', 'reviewer') THEN RAISE EXCEPTION 'Choose how it is measured.'; END IF;
  IF _id IS NULL THEN
    IF _source = 'automatic' THEN RAISE EXCEPTION 'A new goal is entered by the reviewer until Resolve can count it.'; END IF;
    INSERT INTO public.bonus_goals (plan_code, position, code, name, share, unit, threshold_met, threshold_strong,
                                    threshold_exceeds, source, measure_key, how_measured, active, updated_by)
    VALUES (_plan, coalesce((SELECT max(position) FROM public.bonus_goals WHERE plan_code = _plan), 0) + 1,
            'custom_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), btrim(_name), _share, _unit,
            _met, _strong, _exceeds, 'reviewer', NULL, nullif(btrim(coalesce(_how, '')), ''), coalesce(_active, true), auth.uid())
    RETURNING id INTO _new;
    PERFORM private.bonus_log('goal', _new::text, 'added', NULL,
      jsonb_build_object('plan', _plan, 'name', btrim(_name), 'share', _share, 'unit', _unit, 'goal_met', _met,
                         'strong', _strong, 'exceeds', _exceeds, 'source', 'reviewer', 'active', coalesce(_active, true)), _reason);
    RETURN _new;
  END IF;
  SELECT * INTO g FROM public.bonus_goals WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This goal was not found.'; END IF;
  IF _source = 'automatic' AND g.measure_key IS NULL THEN
    RAISE EXCEPTION 'Resolve cannot count this goal yet, so it is entered by the reviewer.';
  END IF;
  PERFORM private.bonus_log('goal', g.id::text, 'name', to_jsonb(g.name), to_jsonb(btrim(_name)), _reason);
  PERFORM private.bonus_log('goal', g.id::text, 'share', to_jsonb(g.share), to_jsonb(_share), _reason);
  PERFORM private.bonus_log('goal', g.id::text, 'unit', to_jsonb(g.unit), to_jsonb(_unit), _reason);
  PERFORM private.bonus_log('goal', g.id::text, 'targets',
    jsonb_build_array(g.threshold_met, g.threshold_strong, g.threshold_exceeds), jsonb_build_array(_met, _strong, _exceeds), _reason);
  PERFORM private.bonus_log('goal', g.id::text, 'source', to_jsonb(g.source), to_jsonb(_source), _reason);
  PERFORM private.bonus_log('goal', g.id::text, 'active', to_jsonb(g.active), to_jsonb(coalesce(_active, g.active)), _reason);
  PERFORM private.bonus_log('goal', g.id::text, 'how_measured', to_jsonb(g.how_measured),
    to_jsonb(coalesce(nullif(btrim(coalesce(_how, '')), ''), g.how_measured)), _reason);
  UPDATE public.bonus_goals
     SET name = btrim(_name), share = _share, unit = _unit, threshold_met = _met, threshold_strong = _strong,
         threshold_exceeds = _exceeds, source = _source, active = coalesce(_active, active),
         how_measured = coalesce(nullif(btrim(coalesce(_how, '')), ''), how_measured), updated_by = auth.uid(), updated_at = now()
   WHERE id = _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.bonus_save_goal_targets(_goal uuid, _from date, _met numeric, _strong numeric,
                                                          _exceeds numeric, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  t public.bonus_goal_thresholds;
BEGIN
  PERFORM private.bonus_assert_leader();
  IF _from IS NULL THEN RAISE EXCEPTION 'Choose the first day these targets apply.'; END IF;
  IF _met IS NULL OR _strong < _met OR _exceeds < _strong THEN RAISE EXCEPTION 'Targets must rise from Goal met to Strong to Exceeds.'; END IF;
  SELECT * INTO t FROM public.bonus_goal_thresholds WHERE goal_id = _goal AND applies_from = _from;
  PERFORM private.bonus_log('goal_targets', _goal || ':' || _from, 'targets',
    CASE WHEN t.goal_id IS NULL THEN NULL ELSE jsonb_build_array(t.threshold_met, t.threshold_strong, t.threshold_exceeds) END,
    jsonb_build_array(_met, _strong, _exceeds), _reason);
  INSERT INTO public.bonus_goal_thresholds (goal_id, applies_from, threshold_met, threshold_strong, threshold_exceeds, updated_by)
  VALUES (_goal, _from, _met, _strong, _exceeds, auth.uid())
  ON CONFLICT (goal_id, applies_from) DO UPDATE
    SET threshold_met = EXCLUDED.threshold_met, threshold_strong = EXCLUDED.threshold_strong,
        threshold_exceeds = EXCLUDED.threshold_exceeds, updated_by = EXCLUDED.updated_by, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.bonus_save_participant(_user uuid, _plan text, _eligible_from date, _active boolean,
                                                         _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  bp public.bonus_participants;
BEGIN
  PERFORM private.bonus_assert_leader();
  IF _user IS NULL OR _eligible_from IS NULL THEN RAISE EXCEPTION 'Choose the person and the date they are eligible from.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bonus_plans WHERE code = _plan) THEN RAISE EXCEPTION 'This bonus plan was not found.'; END IF;
  SELECT * INTO bp FROM public.bonus_participants WHERE user_id = _user AND plan_code = _plan;
  PERFORM private.bonus_log('person', _user || ':' || _plan, 'eligible_from', to_jsonb(bp.eligible_from), to_jsonb(_eligible_from), _reason);
  PERFORM private.bonus_log('person', _user || ':' || _plan, 'active', to_jsonb(bp.active), to_jsonb(coalesce(_active, true)), _reason);
  INSERT INTO public.bonus_participants (user_id, plan_code, eligible_from, active, updated_by)
  VALUES (_user, _plan, _eligible_from, coalesce(_active, true), auth.uid())
  ON CONFLICT (user_id, plan_code) DO UPDATE
    SET eligible_from = EXCLUDED.eligible_from, active = EXCLUDED.active, updated_by = EXCLUDED.updated_by, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.bonus_save_priority(_id uuid, _user uuid, _start date, _name text, _points int,
                                                      _status text, _accepted_on date, _result_note text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  x public.bonus_priorities;
  _new uuid;
BEGIN
  PERFORM private.bonus_assert_leader();
  IF length(btrim(coalesce(_name, ''))) < 3 THEN RAISE EXCEPTION 'Name the priority.'; END IF;
  IF _points IS NULL OR _points < 0 OR _points > 100 THEN RAISE EXCEPTION 'Points are from 0 to 100.'; END IF;
  IF _status NOT IN ('proposed', 'accepted', 'in_use', 'result_agreed') THEN RAISE EXCEPTION 'Choose the status.'; END IF;
  IF _status <> 'proposed' AND _accepted_on IS NULL THEN RAISE EXCEPTION 'Add the date it was accepted.'; END IF;
  IF _status = 'result_agreed' AND length(btrim(coalesce(_result_note, ''))) < 3 THEN RAISE EXCEPTION 'Write the agreed result.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.bonus_period('director_ops', _start) p WHERE p.period_start = _start) THEN
    RAISE EXCEPTION 'Choose a Director of Operations period.';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.bonus_priorities (user_id, period_start, name, points, status, accepted_on, result_note, updated_by)
    VALUES (_user, _start, btrim(_name), _points, _status, _accepted_on, nullif(btrim(coalesce(_result_note, '')), ''), auth.uid())
    RETURNING id INTO _new;
    PERFORM private.bonus_log('priority', _new::text, 'added', NULL,
      jsonb_build_object('name', btrim(_name), 'points', _points, 'status', _status, 'accepted_on', _accepted_on), NULL);
    RETURN _new;
  END IF;
  SELECT * INTO x FROM public.bonus_priorities WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This priority was not found.'; END IF;
  PERFORM private.bonus_log('priority', _id::text, 'priority',
    jsonb_build_object('name', x.name, 'points', x.points, 'status', x.status, 'accepted_on', x.accepted_on, 'result', x.result_note),
    jsonb_build_object('name', btrim(_name), 'points', _points, 'status', _status, 'accepted_on', _accepted_on,
                       'result', nullif(btrim(coalesce(_result_note, '')), '')), NULL);
  UPDATE public.bonus_priorities
     SET name = btrim(_name), points = _points, status = _status, accepted_on = _accepted_on,
         result_note = nullif(btrim(coalesce(_result_note, '')), ''), updated_by = auth.uid(), updated_at = now()
   WHERE id = _id;
  RETURN _id;
END $$;

-- 15. When a period closes: one item and email for the reviewer, one reminder after 2 days.
CREATE OR REPLACE FUNCTION private.bonus_sweep(_now timestamptz)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _today date := (_now AT TIME ZONE 'America/Chicago')::date;
  r record;
  per record;
  _day date;
  _id uuid;
  _rev uuid;
  _ready int := 0;
  _reminded int := 0;
BEGIN
  FOR r IN SELECT bp.user_id, bp.plan_code, bp.eligible_from, p.counting_start, p.reviewer_role, p.name
             FROM public.bonus_participants bp JOIN public.bonus_plans p ON p.code = bp.plan_code
            WHERE bp.active LOOP
    _day := _today - 1;
    FOR i IN 1..2 LOOP
      SELECT * INTO per FROM private.bonus_period(r.plan_code, _day);
      EXIT WHEN per.period_start IS NULL;
      IF per.period_end < _today AND per.period_end >= greatest(r.counting_start, r.eligible_from) THEN
        _id := NULL;
        INSERT INTO public.bonus_periods (plan_code, user_id, period_start, period_end, label, ready_at)
        VALUES (r.plan_code, r.user_id, per.period_start, per.period_end, per.label, _now)
        ON CONFLICT (plan_code, user_id, period_start) DO NOTHING
        RETURNING id INTO _id;
        IF _id IS NOT NULL THEN
          _ready := _ready + 1;
          _rev := public.seat_holder_at(r.reviewer_role, _now);
          IF _rev IS NOT NULL AND _rev <> r.user_id THEN
            PERFORM public.notify_staff(_rev, 'bonus_ready', per.label || ' is ready to verify for ' || r.name,
              'Open Bonus verify to check the numbers and verify them.', 'bonus_period', _id, '/bonus-verify', NULL, NULL, true, false);
          END IF;
          UPDATE public.bonus_periods SET notified_at = _now WHERE id = _id;
        END IF;
      END IF;
      _day := per.period_start - 1;
    END LOOP;
  END LOOP;

  FOR r IN SELECT b.id, b.user_id, b.label, p.reviewer_role, p.name FROM public.bonus_periods b
             JOIN public.bonus_plans p ON p.code = b.plan_code
            WHERE b.status = 'ready' AND b.reminded_at IS NULL AND b.ready_at <= _now - interval '2 days' LOOP
    _rev := public.seat_holder_at(r.reviewer_role, _now);
    IF _rev IS NOT NULL AND _rev <> r.user_id THEN
      PERFORM public.notify_staff(_rev, 'bonus_ready_reminder', 'Reminder: ' || r.label || ' is ready to verify for ' || r.name,
        'Open Bonus verify to check the numbers and verify them.', 'bonus_period', r.id, '/bonus-verify', NULL, NULL, true, false);
    END IF;
    UPDATE public.bonus_periods SET reminded_at = _now WHERE id = r.id;
    _reminded := _reminded + 1;
  END LOOP;
  RETURN jsonb_build_object('ready', _ready, 'reminded', _reminded);
END $$;

-- 16. Who may call what.
REVOKE ALL ON FUNCTION private.bonus_is_leader(uuid), private.bonus_pc_roles(), private.bonus_period(text, date),
  private.bonus_pays_on(date), private.bonus_question_closes(timestamptz),
  private.bonus_shifts(uuid, text[], timestamptz, timestamptz),
  private.bonus_facts(text, uuid, timestamptz, timestamptz, text, date, date), private.bonus_measure_built(text),
  private.bonus_compute(text, uuid, date, timestamptz), private.bonus_can_view(uuid, uuid, text),
  private.bonus_is_reviewer(uuid, uuid, text), private.bonus_assert_open(text, uuid, date),
  private.bonus_log(text, text, text, jsonb, jsonb, text), private.bonus_assert_leader(), private.bonus_sweep(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bonus_is_leader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bonus_is_leader(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.bonus_my_plans(), public.bonus_people(), public.bonus_my_reviews(),
  public.bonus_scorecard(text, uuid, date), public.bonus_enter_measure(text, uuid, date, uuid, numeric, text, text),
  public.bonus_request_adjustment(text, uuid, date, uuid, text, text, text), public.bonus_decide_adjustment(uuid, boolean, text),
  public.bonus_verify(text, uuid, date), public.bonus_reopen(text, uuid, date, text), public.bonus_raise_question(text, date, text),
  public.bonus_answer_question(uuid, text), public.bonus_payouts(), public.bonus_settings(),
  public.bonus_save_plan(text, date, numeric, numeric, numeric, text),
  public.bonus_save_period_amounts(text, date, date, text, numeric, numeric, numeric, text),
  public.bonus_save_goal(uuid, text, text, numeric, text, numeric, numeric, numeric, text, boolean, text, text),
  public.bonus_save_goal_targets(uuid, date, numeric, numeric, numeric, text),
  public.bonus_save_participant(uuid, text, date, boolean, text),
  public.bonus_save_priority(uuid, uuid, date, text, int, text, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bonus_my_plans(), public.bonus_people(), public.bonus_my_reviews(),
  public.bonus_scorecard(text, uuid, date), public.bonus_enter_measure(text, uuid, date, uuid, numeric, text, text),
  public.bonus_request_adjustment(text, uuid, date, uuid, text, text, text), public.bonus_decide_adjustment(uuid, boolean, text),
  public.bonus_verify(text, uuid, date), public.bonus_reopen(text, uuid, date, text), public.bonus_raise_question(text, date, text),
  public.bonus_answer_question(uuid, text), public.bonus_payouts(), public.bonus_settings(),
  public.bonus_save_plan(text, date, numeric, numeric, numeric, text),
  public.bonus_save_period_amounts(text, date, date, text, numeric, numeric, numeric, text),
  public.bonus_save_goal(uuid, text, text, numeric, text, numeric, numeric, numeric, text, boolean, text, text),
  public.bonus_save_goal_targets(uuid, date, numeric, numeric, numeric, text),
  public.bonus_save_participant(uuid, text, date, boolean, text),
  public.bonus_save_priority(uuid, uuid, date, text, int, text, date, text)
  TO authenticated;

-- 17. The hourly check for closed periods and reminders.
SELECT cron.schedule('bonus-periods', '17 * * * *', 'SELECT private.bonus_sweep(now())');
