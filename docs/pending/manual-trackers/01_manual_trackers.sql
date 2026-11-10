-- Build 14: the three manual trackers (Team records, Coaching, Weekly scorecard) (Emily, Nov 10;
-- register BN3, BN7, BN8, BN9, with the Nov 10 corrections in docs/specs/bonus-guide-values.md G:
-- 5 records per active coordinator, the Director's double check of 5, one coaching session per
-- coordinator a month, the weekly scorecard covers work through Wednesday).
-- Additive: new tables, new functions, two new fact kinds, one weekly job. The Build 13 engine
-- functions private.bonus_facts and private.bonus_measure_built are replaced so the three goals
-- read these facts; their undo puts back the Build 13 text exactly. No BEGIN/COMMIT.

-- 0. Two new fact kinds. Every existing kind stays.
ALTER TABLE public.scorecard_records DROP CONSTRAINT IF EXISTS scorecard_records_kind_check;
ALTER TABLE public.scorecard_records ADD CONSTRAINT scorecard_records_kind_check CHECK (kind IN
  ('arrival_readiness', 'queue_sweep', 'coaching_cycle', 'weekly_submission', 'corrective_commitment',
   'finance_packet', 'arrival_check', 'records_check', 'records_check_review'));

-- 1. Settings (changed on the pages by the Director of Operations, the COO, the CEO or Admin).
INSERT INTO public.app_settings (key, value) VALUES
  ('team_records_settings', '{"per_coordinator": 5, "director_checks": 5}'::jsonb),
  ('coaching_settings', '{"per_month": 1, "per_coordinator": {}}'::jsonb),
  ('weekly_scorecard_settings', '{"first_due": "2026-11-19"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Who is who.
CREATE OR REPLACE FUNCTION private.mt_is_sup(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _u IS NOT NULL AND private.sc_is_ops_supervisor(_u)
$$;
CREATE OR REPLACE FUNCTION private.mt_is_dir(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _u IS NOT NULL AND private.sc_holds(_u, 'director_ops')
$$;
-- The Operations Supervisor, the Director of Operations, the COO, the CEO and Admin.
CREATE OR REPLACE FUNCTION private.mt_is_lead(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _u IS NOT NULL AND (private.mt_is_sup(_u) OR private.mt_is_dir(_u) OR private.bonus_is_leader(_u))
$$;
-- Settings: the Director of Operations, the COO, the CEO and Admin. Never the person the goal is about.
CREATE OR REPLACE FUNCTION private.mt_can_set(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _u IS NOT NULL AND (private.mt_is_dir(_u) OR private.bonus_is_leader(_u))
$$;
CREATE OR REPLACE FUNCTION private.mt_is_finance(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _u IS NOT NULL AND public.is_finance_lead(_u)
$$;
CREATE OR REPLACE FUNCTION private.mt_setting(_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce((SELECT value FROM public.app_settings WHERE key = _key), '{}'::jsonb)
$$;
CREATE OR REPLACE FUNCTION private.mt_coaching_required(_u uuid) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT greatest(0, coalesce((private.mt_setting('coaching_settings') -> 'per_coordinator' ->> _u::text)::int,
                              (private.mt_setting('coaching_settings') ->> 'per_month')::int, 1))
$$;
CREATE OR REPLACE FUNCTION private.mt_first_due() RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce((private.mt_setting('weekly_scorecard_settings') ->> 'first_due')::date, '2026-11-19'::date)
$$;
CREATE OR REPLACE FUNCTION private.mt_due_at(_due date) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT ((_due::timestamp + interval '15 hours') AT TIME ZONE 'America/Chicago') $$;
CREATE OR REPLACE FUNCTION private.mt_opens_at(_due date) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT (_due::timestamp AT TIME ZONE 'America/Chicago') $$;
CREATE OR REPLACE FUNCTION private.mt_monday(_at timestamptz) RETURNS date
LANGUAGE sql IMMUTABLE AS $$ SELECT date_trunc('week', _at AT TIME ZONE 'America/Chicago')::date $$;
CREATE OR REPLACE FUNCTION private.mt_checklist_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['notes_complete', 'guest_communication', 'expenses_tracked', 'handoff_ready', 'proof_attached']
$$;

-- 3. The weekly draw of team records. One row per drawn record; a record is never drawn twice.
CREATE TABLE public.team_record_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  draw_no int NOT NULL,
  record_kind text NOT NULL CHECK (record_kind IN ('ticket', 'routine', 'handoff')),
  record_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  label text NOT NULL,
  record_at timestamptz NOT NULL,
  link_path text,
  replaces uuid REFERENCES public.team_record_draws(id),
  drawn_by text NOT NULL CHECK (drawn_by IN ('schedule', 'skip')),
  drawn_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (record_kind, record_id),
  UNIQUE (week_start, draw_no)
);
-- The Director's double check: which of the week's reviews were chosen at random.
CREATE TABLE public.team_record_check_picks (
  review_id uuid PRIMARY KEY REFERENCES public.scorecard_records(id),
  week_start date NOT NULL,
  picked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- The Supervisor's unsent weekly scorecard notes. Submitted versions are permanent facts.
CREATE TABLE public.weekly_scorecard_drafts (
  due_on date PRIMARY KEY,
  manual jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_record_draws_week ON public.team_record_draws (week_start);

GRANT SELECT ON public.team_record_draws, public.team_record_check_picks, public.weekly_scorecard_drafts TO authenticated;
GRANT ALL ON public.team_record_draws, public.team_record_check_picks, public.weekly_scorecard_drafts TO service_role;
ALTER TABLE public.team_record_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_record_check_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_scorecard_drafts ENABLE ROW LEVEL SECURITY;
-- Reads only for the leads; every page reads through the checked functions below.
CREATE POLICY team_record_draws_leads ON public.team_record_draws FOR SELECT TO authenticated USING (private.mt_is_lead(auth.uid()));
CREATE POLICY team_record_check_picks_leads ON public.team_record_check_picks FOR SELECT TO authenticated USING (private.mt_is_lead(auth.uid()));
CREATE POLICY weekly_scorecard_drafts_leads ON public.weekly_scorecard_drafts FOR SELECT TO authenticated USING (private.mt_is_lead(auth.uid()));
CREATE TRIGGER team_record_draws_keep BEFORE UPDATE OR DELETE ON public.team_record_draws
  FOR EACH ROW EXECUTE FUNCTION private.refuse_record_change();
CREATE TRIGGER team_record_check_picks_keep BEFORE UPDATE OR DELETE ON public.team_record_check_picks
  FOR EACH ROW EXECUTE FUNCTION private.refuse_record_change();

-- Work a coordinator did in the 7 days before Monday: tickets they owned (opened or closed that
-- week), routine checks they completed and shifts they handed off. Never demo, archived or
-- imported Notion tickets, never the Supervisor's own records, never a record drawn before.
CREATE OR REPLACE FUNCTION private.mt_candidates(_week date)
RETURNS TABLE (record_kind text, record_id uuid, owner_id uuid, label text, record_at timestamptz, link_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH win AS (SELECT ((_week - 7)::timestamp AT TIME ZONE 'America/Chicago') AS f,
                      (_week::timestamp AT TIME ZONE 'America/Chicago') AS t),
  pcs AS (SELECT p.user_id FROM public.bonus_participants p
           WHERE p.plan_code = 'coordinator' AND p.active
             AND p.user_id IS DISTINCT FROM public.seat_holder_at('ops_supervisor', now())),
  c AS (
    SELECT 'ticket'::text AS k, t.id, t.assigned_to AS o, coalesce(t.title, 'Ticket') AS l,
           coalesce(t.resolved_at, t.created_at) AS a, '/tickets/' || t.id AS lp
      FROM public.tickets t, win
     WHERE t.assigned_to IN (SELECT user_id FROM pcs) AND NOT t.is_demo AND t.archived_at IS NULL
       AND coalesce(t.external_source, '') <> 'notion' AND coalesce(t.department_code, 'operations') = 'operations'
       AND coalesce(t.resolved_at, t.created_at) >= win.f AND coalesce(t.resolved_at, t.created_at) < win.t
    UNION ALL
    SELECT 'routine', r.id, r.assigned_to, 'Routine work: ' || coalesce(r.title, r.kind, 'check'), r.completed_at, '/routines'
      FROM public.routine_controls r, win
     WHERE r.assigned_to IN (SELECT user_id FROM pcs) AND NOT r.is_demo AND r.status = 'completed'
       AND r.completed_at >= win.f AND r.completed_at < win.t
    UNION ALL
    SELECT 'handoff', s.id, s.user_id,
           CASE WHEN s.nothing_to_hand_off THEN 'Shift end: Nothing to hand off' ELSE 'Shift end handoff' END, s.ended_at, NULL
      FROM public.shift_end_records s, win
     WHERE s.user_id IN (SELECT user_id FROM pcs) AND NOT s.is_demo
       AND s.ended_at >= win.f AND s.ended_at < win.t)
  SELECT c.k, c.id, c.o, c.l, c.a, c.lp FROM c
   WHERE NOT EXISTS (SELECT 1 FROM public.team_record_draws d WHERE d.record_kind = c.k AND d.record_id = c.id)
$$;

-- The Monday draw: 5 a coordinator (the setting) at random, then any shortfall filled at random
-- from the other coordinators' work, so the week still has 5 per active coordinator if it can.
CREATE OR REPLACE FUNCTION private.mt_draw(_week date)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _per int := greatest(0, coalesce((private.mt_setting('team_records_settings') ->> 'per_coordinator')::int, 5));
  _pcs int;
  _want int;
  _n int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('team_records_draw:' || _week));
  IF EXISTS (SELECT 1 FROM public.team_record_draws WHERE week_start = _week AND drawn_by = 'schedule') THEN RETURN 0; END IF;
  SELECT count(*) INTO _pcs FROM public.bonus_participants p
   WHERE p.plan_code = 'coordinator' AND p.active AND p.user_id IS DISTINCT FROM public.seat_holder_at('ops_supervisor', now());
  _want := _per * _pcs;
  IF _want = 0 THEN RETURN 0; END IF;
  WITH cand AS (SELECT c.*, random() AS r FROM private.mt_candidates(_week) c),
  ranked AS (SELECT cand.*, row_number() OVER (PARTITION BY cand.owner_id ORDER BY cand.r) AS rn FROM cand),
  p1 AS (SELECT * FROM ranked WHERE rn <= _per),
  p2 AS (SELECT * FROM ranked WHERE rn > _per ORDER BY r LIMIT greatest(0, _want - (SELECT count(*) FROM p1))),
  picked AS (SELECT p1.*, 1 AS ord FROM p1 UNION ALL SELECT p2.*, 2 FROM p2)
  INSERT INTO public.team_record_draws (week_start, draw_no, record_kind, record_id, owner_id, label, record_at, link_path, drawn_by)
  SELECT _week, row_number() OVER (ORDER BY x.ord, x.r), x.record_kind, x.record_id, x.owner_id, x.label, x.record_at, x.link_path, 'schedule'
    FROM picked x
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- After a skip: one more record from the same week, the same coordinator first.
CREATE OR REPLACE FUNCTION private.mt_draw_one(_skipped public.team_record_draws)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.team_record_draws (week_start, draw_no, record_kind, record_id, owner_id, label, record_at, link_path, replaces, drawn_by)
  SELECT _skipped.week_start,
         (SELECT coalesce(max(d.draw_no), 0) + 1 FROM public.team_record_draws d WHERE d.week_start = _skipped.week_start),
         c.record_kind, c.record_id, c.owner_id, c.label, c.record_at, c.link_path, _skipped.id, 'skip'
    FROM private.mt_candidates(_skipped.week_start) c
   ORDER BY (c.owner_id = _skipped.owner_id) DESC, random()
   LIMIT 1
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION private.mt_review_of(_draw uuid) RETURNS public.scorecard_records
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT r.* FROM public.scorecard_records r
   WHERE r.kind = 'records_check' AND r.details ->> 'draw_id' = _draw::text AND r.details ->> 'action' IN ('review', 'skip')
   ORDER BY r.recorded_at LIMIT 1
$$;

-- The result that counts: the Supervisor's call, unless the Director disagreed on the double check.
CREATE OR REPLACE FUNCTION private.mt_final_clean(_review uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT CASE WHEN (SELECT (c.details ->> 'agree')::boolean FROM public.scorecard_records c
                     WHERE c.kind = 'records_check_review' AND c.refers_to = r.id ORDER BY c.recorded_at DESC LIMIT 1) IS FALSE
              THEN r.details ->> 'result' <> 'clean' ELSE r.details ->> 'result' = 'clean' END
    FROM public.scorecard_records r WHERE r.id = _review
$$;

-- The Director's double check: random reviews of a finished week (every record done, or the week over).
CREATE OR REPLACE FUNCTION private.mt_pick_checks(_week date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _want int := greatest(0, coalesce((private.mt_setting('team_records_settings') ->> 'director_checks')::int, 5));
  _have int;
BEGIN
  IF now() < ((_week + 7)::timestamp AT TIME ZONE 'America/Chicago')
     AND EXISTS (SELECT 1 FROM public.team_record_draws d WHERE d.week_start = _week AND (private.mt_review_of(d.id)).id IS NULL) THEN
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('team_records_picks:' || _week));
  SELECT count(*) INTO _have FROM public.team_record_check_picks WHERE week_start = _week;
  IF _have >= _want THEN RETURN; END IF;
  INSERT INTO public.team_record_check_picks (review_id, week_start)
  SELECT r.id, _week FROM public.scorecard_records r
   WHERE r.kind = 'records_check' AND r.details ->> 'action' = 'review' AND r.details ->> 'week_start' = _week::text
     AND NOT EXISTS (SELECT 1 FROM public.team_record_check_picks p WHERE p.review_id = r.id)
   ORDER BY random()
   LIMIT _want - _have
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION private.mt_sweep(_now timestamptz)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF extract(isodow FROM _now AT TIME ZONE 'America/Chicago') = 1
     AND extract(hour FROM _now AT TIME ZONE 'America/Chicago') >= 6 THEN
    PERFORM private.mt_pick_checks(private.mt_monday(_now) - 7);
    RETURN private.mt_draw(private.mt_monday(_now));
  END IF;
  RETURN 0;
END $$;

-- 4. Team records pages.
CREATE OR REPLACE FUNCTION private.mt_week_items(_week date, _full boolean)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'draw_no', d.draw_no, 'kind', d.record_kind, 'label', CASE WHEN _full THEN d.label END,
           'record_at', d.record_at, 'link', CASE WHEN _full THEN d.link_path END, 'owner_id', d.owner_id,
           'owner_name', coalesce(pr.full_name, 'Coordinator'), 'replaces', d.replaces,
           'status', CASE WHEN rv.id IS NULL THEN 'waiting' WHEN rv.details ->> 'action' = 'skip' THEN 'skipped'
                          ELSE rv.details ->> 'result' END,
           'final', CASE WHEN rv.details ->> 'action' = 'review' THEN
                           CASE WHEN private.mt_final_clean(rv.id) THEN 'clean' ELSE 'not_clean' END END,
           'review_id', CASE WHEN rv.details ->> 'action' = 'review' THEN rv.id END,
           'reviewed_at', rv.recorded_at,
           'reviewed_by', CASE WHEN _full THEN (SELECT full_name FROM public.profiles WHERE id = rv.recorded_by) END,
           'checklist', CASE WHEN _full THEN rv.details -> 'checklist' END,
           'note', CASE WHEN _full THEN rv.note END,
           'evidence_url', CASE WHEN _full THEN rv.details ->> 'evidence_url' END,
           'picked', pk.review_id IS NOT NULL,
           'check', CASE WHEN ck.id IS NULL THEN NULL ELSE jsonb_build_object(
                      'agree', (ck.details ->> 'agree')::boolean, 'note', CASE WHEN _full THEN ck.note END, 'at', ck.recorded_at) END)
           ORDER BY d.draw_no), '[]'::jsonb)
    FROM public.team_record_draws d
    LEFT JOIN public.profiles pr ON pr.id = d.owner_id
    LEFT JOIN LATERAL (SELECT (private.mt_review_of(d.id)).*) rv ON true
    LEFT JOIN public.team_record_check_picks pk ON pk.review_id = rv.id
    LEFT JOIN LATERAL (SELECT c.* FROM public.scorecard_records c WHERE c.kind = 'records_check_review' AND c.refers_to = rv.id
                        ORDER BY c.recorded_at DESC LIMIT 1) ck ON true
   WHERE d.week_start = _week
$$;

CREATE OR REPLACE FUNCTION public.team_records_week(_week date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _lead boolean := private.mt_is_lead(_me);
  _w date := coalesce(_week, private.mt_monday(now()));
  _items jsonb;
BEGIN
  IF NOT (_lead OR private.mt_is_finance(_me)) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor, the Director of Operations, the COO, Admin and Finance open this.';
  END IF;
  IF extract(isodow FROM _w) <> 1 THEN RAISE EXCEPTION 'Choose a week starting on a Monday.'; END IF;
  IF _w = private.mt_monday(now()) AND now() >= ((_w::timestamp + interval '6 hours') AT TIME ZONE 'America/Chicago') THEN
    PERFORM private.mt_draw(_w);
  END IF;
  IF _lead THEN PERFORM private.mt_pick_checks(_w); END IF;
  _items := private.mt_week_items(_w, _lead);
  RETURN jsonb_build_object(
    'view', CASE WHEN _lead THEN 'lead' ELSE 'finance' END,
    'week_start', _w, 'from', _w - 7, 'to', _w - 1,
    'draws_at', ((_w::timestamp + interval '6 hours') AT TIME ZONE 'America/Chicago'),
    'per_coordinator', coalesce((private.mt_setting('team_records_settings') ->> 'per_coordinator')::int, 5),
    'director_checks', coalesce((private.mt_setting('team_records_settings') ->> 'director_checks')::int, 5),
    'items', CASE WHEN _lead THEN _items ELSE '[]'::jsonb END,
    'total', (SELECT count(*) FROM jsonb_array_elements(_items) e WHERE e ->> 'status' <> 'skipped'),
    'reviewed', (SELECT count(*) FROM jsonb_array_elements(_items) e WHERE e ->> 'status' IN ('clean', 'not_clean')),
    'clean', (SELECT count(*) FROM jsonb_array_elements(_items) e WHERE e ->> 'final' = 'clean'),
    'not_clean', (SELECT count(*) FROM jsonb_array_elements(_items) e WHERE e ->> 'final' = 'not_clean'),
    'skipped', (SELECT count(*) FROM jsonb_array_elements(_items) e WHERE e ->> 'status' = 'skipped'),
    'picked', (SELECT count(*) FROM jsonb_array_elements(_items) e WHERE (e ->> 'picked')::boolean),
    'checked', (SELECT count(*) FROM jsonb_array_elements(_items) e WHERE e -> 'check' IS NOT NULL AND e -> 'check' <> 'null'::jsonb),
    'can_review', private.mt_is_sup(_me),
    'can_check', private.mt_is_dir(_me),
    'can_set', private.mt_can_set(_me));
END $$;

CREATE OR REPLACE FUNCTION public.team_records_weeks()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT (private.mt_is_lead(auth.uid()) OR private.mt_is_finance(auth.uid())) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor, the Director of Operations, the COO, Admin and Finance open this.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('week_start', w.week_start,
             'total', (SELECT count(*) FROM jsonb_array_elements(w.items) e WHERE e ->> 'status' <> 'skipped'),
             'reviewed', (SELECT count(*) FROM jsonb_array_elements(w.items) e WHERE e ->> 'status' IN ('clean', 'not_clean')),
             'clean', (SELECT count(*) FROM jsonb_array_elements(w.items) e WHERE e ->> 'final' = 'clean'),
             'not_clean', (SELECT count(*) FROM jsonb_array_elements(w.items) e WHERE e ->> 'final' = 'not_clean'),
             'skipped', (SELECT count(*) FROM jsonb_array_elements(w.items) e WHERE e ->> 'status' = 'skipped'))
             ORDER BY w.week_start DESC)
      FROM (SELECT x.week_start, private.mt_week_items(x.week_start, false) AS items
              FROM (SELECT DISTINCT week_start FROM public.team_record_draws) x) w), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.team_records_review(_draw uuid, _clean boolean, _checklist jsonb, _note text,
                                                     _evidence_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  d public.team_record_draws;
  _all boolean;
  _list jsonb;
  _id uuid;
BEGIN
  IF NOT private.mt_is_sup(_me) THEN RAISE EXCEPTION 'Only the Operations Supervisor reviews team records.'; END IF;
  SELECT * INTO d FROM public.team_record_draws WHERE id = _draw FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This record was not drawn for review.'; END IF;
  IF d.owner_id = _me THEN RAISE EXCEPTION 'Nobody reviews their own records.'; END IF;
  IF (private.mt_review_of(d.id)).id IS NOT NULL THEN RAISE EXCEPTION 'This record already has a review.'; END IF;
  IF _clean IS NULL THEN RAISE EXCEPTION 'Mark it Clean or Not clean.'; END IF;
  SELECT jsonb_object_agg(k, coalesce((_checklist ->> k)::boolean, false)), bool_and(coalesce((_checklist ->> k)::boolean, false))
    INTO _list, _all FROM unnest(private.mt_checklist_keys()) k;
  IF _clean AND NOT _all THEN
    RAISE EXCEPTION 'A record is clean only when every item is there, proof included. Mark it Not clean.';
  END IF;
  IF NOT _clean AND length(btrim(coalesce(_note, ''))) < 3 THEN RAISE EXCEPTION 'Add a note about what is missing.'; END IF;
  IF NOT _clean AND coalesce(btrim(_evidence_url), '') !~* '^https?://[^ ]+$' THEN
    RAISE EXCEPTION 'Add a link to the evidence.';
  END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, ticket_id, note, details)
  VALUES ('records_check', _me, CASE WHEN d.record_kind = 'ticket' THEN d.record_id END,
          nullif(left(btrim(coalesce(_note, '')), 2000), ''),
          jsonb_build_object('action', 'review', 'draw_id', d.id, 'week_start', d.week_start, 'owner_id', d.owner_id,
                             'record_kind', d.record_kind, 'record_id', d.record_id, 'label', d.label,
                             'result', CASE WHEN _clean THEN 'clean' ELSE 'not_clean' END, 'checklist', _list,
                             'evidence_url', nullif(btrim(coalesce(_evidence_url, '')), '')))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.team_records_skip(_draw uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  d public.team_record_draws;
  _new uuid;
BEGIN
  IF NOT private.mt_is_sup(_me) THEN RAISE EXCEPTION 'Only the Operations Supervisor reviews team records.'; END IF;
  SELECT * INTO d FROM public.team_record_draws WHERE id = _draw FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This record was not drawn for review.'; END IF;
  IF (private.mt_review_of(d.id)).id IS NOT NULL THEN RAISE EXCEPTION 'This record already has a review.'; END IF;
  IF length(btrim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'Write why this record cannot be reviewed.'; END IF;
  _new := private.mt_draw_one(d);
  INSERT INTO public.scorecard_records (kind, recorded_by, ticket_id, note, details)
  VALUES ('records_check', _me, CASE WHEN d.record_kind = 'ticket' THEN d.record_id END, left(btrim(_reason), 2000),
          jsonb_build_object('action', 'skip', 'draw_id', d.id, 'week_start', d.week_start, 'owner_id', d.owner_id,
                             'record_kind', d.record_kind, 'record_id', d.record_id, 'label', d.label, 'replacement_id', _new));
  RETURN jsonb_build_object('replacement_id', _new);
END $$;

CREATE OR REPLACE FUNCTION public.team_records_double_check(_review uuid, _agree boolean, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  r public.scorecard_records;
  _id uuid;
BEGIN
  IF NOT private.mt_is_dir(_me) THEN RAISE EXCEPTION 'Only the Director of Operations double checks the record reviews.'; END IF;
  SELECT * INTO r FROM public.scorecard_records WHERE id = _review AND kind = 'records_check' AND details ->> 'action' = 'review';
  IF NOT FOUND THEN RAISE EXCEPTION 'This review was not found.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_record_check_picks WHERE review_id = _review) THEN
    RAISE EXCEPTION 'Only the reviews chosen at random are double checked.';
  END IF;
  IF r.recorded_by = _me THEN RAISE EXCEPTION 'Nobody double checks their own review.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('team_records_check:' || _review));
  IF EXISTS (SELECT 1 FROM public.scorecard_records WHERE kind = 'records_check_review' AND refers_to = _review) THEN
    RAISE EXCEPTION 'This review is already double checked.';
  END IF;
  IF _agree IS NULL THEN RAISE EXCEPTION 'Choose Agree or Disagree.'; END IF;
  IF NOT _agree AND length(btrim(coalesce(_note, ''))) < 3 THEN RAISE EXCEPTION 'Add a note about why you disagree.'; END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, ticket_id, refers_to, note, details)
  VALUES ('records_check_review', _me, CASE WHEN r.details ->> 'record_kind' = 'ticket' THEN (r.details ->> 'record_id')::uuid END,
          r.id, nullif(left(btrim(coalesce(_note, '')), 2000), ''),
          jsonb_build_object('agree', _agree, 'week_start', r.details ->> 'week_start', 'draw_id', r.details ->> 'draw_id',
                             'owner_id', r.details ->> 'owner_id'))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- A coordinator's own results: counts of Clean and Not clean with the notes, from their start date.
CREATE OR REPLACE FUNCTION public.team_records_mine()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _start date;
  _rows jsonb;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT greatest(p.counting_start, coalesce(bp.eligible_from, p.counting_start)) INTO _start
    FROM public.bonus_plans p LEFT JOIN public.bonus_participants bp ON bp.plan_code = p.code AND bp.user_id = _me
   WHERE p.code = 'coordinator';
  _start := coalesce(_start, '2027-01-01'::date);
  IF (now() AT TIME ZONE 'America/Chicago')::date < _start THEN
    RETURN jsonb_build_object('starts_on', _start, 'started', false, 'clean', 0, 'not_clean', 0, 'items', '[]'::jsonb);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'label', r.details ->> 'label', 'kind', r.details ->> 'record_kind',
                                               'at', r.recorded_at, 'final', CASE WHEN private.mt_final_clean(r.id) THEN 'clean' ELSE 'not_clean' END,
                                               'note', r.note) ORDER BY r.recorded_at DESC), '[]'::jsonb)
    INTO _rows
    FROM public.scorecard_records r
   WHERE r.kind = 'records_check' AND r.details ->> 'action' = 'review' AND NOT r.is_demo
     AND r.details ->> 'owner_id' = _me::text
     AND r.recorded_at >= (_start::timestamp AT TIME ZONE 'America/Chicago');
  RETURN jsonb_build_object('starts_on', _start, 'started', true,
    'clean', (SELECT count(*) FROM jsonb_array_elements(_rows) e WHERE e ->> 'final' = 'clean'),
    'not_clean', (SELECT count(*) FROM jsonb_array_elements(_rows) e WHERE e ->> 'final' = 'not_clean'),
    'items', _rows);
END $$;

-- 5. Coaching log. Each session is a permanent coaching fact about the coordinator.
CREATE OR REPLACE FUNCTION private.mt_session_on(_r public.scorecard_records) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT coalesce((_r.details ->> 'session_on')::date, (_r.recorded_at AT TIME ZONE 'America/Chicago')::date)
$$;

CREATE OR REPLACE FUNCTION private.mt_session_json(_r public.scorecard_records) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT jsonb_build_object('id', _r.id, 'coordinator_id', _r.about_user_id,
           'coordinator_name', (SELECT full_name FROM public.profiles WHERE id = _r.about_user_id),
           'session_on', private.mt_session_on(_r), 'type', coalesce(_r.details ->> 'type', 'check_in'),
           'agenda', coalesce(_r.details -> 'agenda', '[]'::jsonb),
           'notes', coalesce(_r.note, _r.details ->> 'improvement'),
           'went_well', coalesce(_r.details ->> 'went_well', _r.details ->> 'strength'),
           'follow_ups', coalesce(_r.details -> 'follow_ups',
                                  CASE WHEN _r.details ->> 'follow_up' IS NOT NULL
                                       THEN jsonb_build_array(jsonb_build_object('text', _r.details ->> 'follow_up')) ELSE '[]'::jsonb END),
           'next_session_on', _r.details ->> 'next_session_on',
           'recorded_by_name', (SELECT full_name FROM public.profiles WHERE id = _r.recorded_by),
           'recorded_at', _r.recorded_at)
$$;

CREATE OR REPLACE FUNCTION public.coaching_save_session(_coordinator uuid, _on date, _type text, _agenda text[], _notes text,
                                                       _went_well text, _follow_ups jsonb, _next_on date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
  _items text[];
  _fu jsonb := '[]'::jsonb;
  f jsonb;
  _id uuid;
BEGIN
  IF NOT private.mt_is_sup(_me) THEN RAISE EXCEPTION 'Only the Operations Supervisor records coaching sessions.'; END IF;
  IF _coordinator IS NULL OR _coordinator = _me
     OR NOT EXISTS (SELECT 1 FROM public.bonus_participants WHERE user_id = _coordinator AND plan_code = 'coordinator' AND active) THEN
    RAISE EXCEPTION 'Choose the coordinator you coached.';
  END IF;
  IF _on IS NULL OR _on > _today OR _on < _today - 60 THEN RAISE EXCEPTION 'Choose the session date, today or in the last 60 days.'; END IF;
  IF _type IS NULL OR _type NOT IN ('check_in', 'training', 'team_feedback', 'onboarding', 'other') THEN
    RAISE EXCEPTION 'Choose the type of session.';
  END IF;
  SELECT coalesce(array_agg(left(btrim(a), 300)), ARRAY[]::text[]) INTO _items
    FROM unnest(coalesce(_agenda, ARRAY[]::text[])) a WHERE btrim(a) <> '';
  IF cardinality(_items) = 0 THEN RAISE EXCEPTION 'Add at least one agenda item.'; END IF;
  IF length(btrim(coalesce(_notes, ''))) < 3 THEN RAISE EXCEPTION 'Add the notes.'; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(coalesce(_follow_ups, '[]'::jsonb)) LOOP
    IF length(btrim(coalesce(f ->> 'text', ''))) = 0 THEN CONTINUE; END IF;
    IF coalesce(f ->> 'owner', '') NOT IN ('coordinator', 'ops_supervisor') THEN RAISE EXCEPTION 'Choose who owns each follow up.'; END IF;
    IF (f ->> 'due_on') IS NULL OR (f ->> 'due_on')::date < _on THEN RAISE EXCEPTION 'Each follow up needs a due date on or after the session.'; END IF;
    _fu := _fu || jsonb_build_array(jsonb_build_object('text', left(btrim(f ->> 'text'), 500), 'owner', f ->> 'owner',
                                                       'due_on', (f ->> 'due_on')::date));
  END LOOP;
  IF _next_on IS NOT NULL AND _next_on <= _on THEN RAISE EXCEPTION 'The next session is after this one.'; END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, about_user_id, note, details)
  VALUES ('coaching_cycle', _me, _coordinator, left(btrim(_notes), 4000),
          jsonb_build_object('source', 'coaching_log', 'session_on', _on, 'month', date_trunc('month', _on)::date, 'type', _type,
                             'agenda', to_jsonb(_items), 'went_well', nullif(left(btrim(coalesce(_went_well, '')), 2000), ''),
                             'follow_ups', _fu, 'next_session_on', _next_on))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.coaching_log(_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _m date := date_trunc('month', coalesce(_month, (now() AT TIME ZONE 'America/Chicago')::date))::date;
  _end date := (_m + interval '1 month')::date - 1;
  _people jsonb;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  IF NOT private.mt_is_lead(_me) THEN
    -- A coordinator sees only their own sessions.
    RETURN jsonb_build_object('view', 'coordinator', 'month', _m,
      'sessions', coalesce((SELECT jsonb_agg(private.mt_session_json(r) ORDER BY private.mt_session_on(r) DESC)
                              FROM public.scorecard_records r
                             WHERE r.kind = 'coaching_cycle' AND r.about_user_id = _me AND NOT r.is_demo), '[]'::jsonb));
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', coalesce(pr.full_name, 'Coordinator'),
           'required', private.mt_coaching_required(p.user_id),
           'done', (SELECT count(*) FROM public.scorecard_records r WHERE r.kind = 'coaching_cycle' AND r.about_user_id = p.user_id
                       AND NOT r.is_demo AND private.mt_session_on(r) BETWEEN _m AND _end))
           ORDER BY pr.full_name), '[]'::jsonb)
    INTO _people
    FROM public.bonus_participants p LEFT JOIN public.profiles pr ON pr.id = p.user_id
   WHERE p.plan_code = 'coordinator' AND p.active;
  RETURN jsonb_build_object('view', 'lead', 'month', _m, 'coordinators', _people,
    'required', (SELECT coalesce(sum((e ->> 'required')::int), 0) FROM jsonb_array_elements(_people) e),
    'done', (SELECT coalesce(sum(least((e ->> 'done')::int, (e ->> 'required')::int)), 0) FROM jsonb_array_elements(_people) e),
    'sessions', coalesce((SELECT jsonb_agg(private.mt_session_json(r) ORDER BY private.mt_session_on(r) DESC, r.recorded_at DESC)
                            FROM public.scorecard_records r
                           WHERE r.kind = 'coaching_cycle' AND NOT r.is_demo AND private.mt_session_on(r) BETWEEN _m AND _end), '[]'::jsonb),
    'settings', private.mt_setting('coaching_settings'),
    'can_record', private.mt_is_sup(_me), 'can_set', private.mt_can_set(_me));
END $$;

-- 6. Weekly scorecard and report. Due Thursday 3 PM Central, covering Thursday to Wednesday.
CREATE OR REPLACE FUNCTION private.mt_count(_key text, _u uuid, _from timestamptz, _to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT jsonb_build_object('met', count(*) FILTER (WHERE f.met), 'total', count(*))
    FROM private.bonus_facts(_key, _u, _from, _to, 'coordinator', NULL::date, NULL::date) f
$$;
CREATE OR REPLACE FUNCTION private.mt_urgent(_u uuid, _from timestamptz, _to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT jsonb_build_object(
           'reply_met', count(*) FILTER (WHERE t.acknowledged_at IS NOT NULL AND t.acknowledged_at <= x.s + interval '3 minutes'),
           'action_met', count(*) FILTER (WHERE t.action_started_at IS NOT NULL AND t.action_started_at <= x.s + interval '5 minutes'),
           'total', count(*))
    FROM public.tickets t CROSS JOIN LATERAL (SELECT coalesce(t.reported_at, t.created_at) AS s) x
   WHERE t.assigned_to = _u AND t.priority = 'p1' AND NOT t.is_demo AND t.archived_at IS NULL
     AND coalesce(t.external_source, '') <> 'notion' AND coalesce(t.department_code, 'operations') = 'operations'
     AND x.s >= _from AND x.s < _to
$$;
CREATE OR REPLACE FUNCTION private.mt_weekly_facts(_due date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH w AS (SELECT ((_due - 7)::timestamp AT TIME ZONE 'America/Chicago') AS f,
                    least((_due::timestamp AT TIME ZONE 'America/Chicago'), now()) AS t)
  SELECT jsonb_build_object('from', _due - 7, 'to', _due - 1, 'as_of', w.t,
    'arrivals', private.mt_count('team_homes_ready', NULL, w.f, w.t),
    'coordinators', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', coalesce(pr.full_name, 'Coordinator'),
                        'follow_through', private.mt_count('pc_follow_through', p.user_id, w.f, w.t),
                        'urgent', private.mt_urgent(p.user_id, w.f, w.t),
                        'handoffs', private.mt_count('pc_shift_handoffs', p.user_id, w.f, w.t),
                        'duties', private.mt_count('pc_team_duties', p.user_id, w.f, w.t),
                        'records', private.mt_count('pc_clean_records', p.user_id, w.f, w.t))
                        ORDER BY pr.full_name)
                  FROM public.bonus_participants p LEFT JOIN public.profiles pr ON pr.id = p.user_id
                 WHERE p.plan_code = 'coordinator' AND p.active), '[]'::jsonb))
    FROM w
$$;
CREATE OR REPLACE FUNCTION private.mt_weekly_events(_due date) RETURNS SETOF public.scorecard_records
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT * FROM public.scorecard_records
   WHERE kind = 'weekly_submission' AND details ->> 'due_on' = _due::text AND NOT is_demo
   ORDER BY recorded_at, id
$$;
-- On time: the first version reached the Director by Thursday 3 PM, and it is not left Returned.
CREATE OR REPLACE FUNCTION private.mt_weekly_met(_due date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce((SELECT min(e.recorded_at) FROM private.mt_weekly_events(_due) e WHERE e.details ->> 'action' = 'submitted')
                  <= private.mt_due_at(_due), false)
     AND coalesce((SELECT e.details ->> 'action' FROM private.mt_weekly_events(_due) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1), '')
         <> 'returned'
$$;
CREATE OR REPLACE FUNCTION private.mt_weekly_status(_due date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT CASE WHEN f IS NULL THEN CASE WHEN now() > private.mt_due_at(_due) THEN 'not_submitted' ELSE 'open' END
              WHEN f <= private.mt_due_at(_due) THEN 'on_time' ELSE 'late' END
    FROM (SELECT min(e.recorded_at) AS f FROM private.mt_weekly_events(_due) e WHERE e.details ->> 'action' = 'submitted') x
$$;
CREATE OR REPLACE FUNCTION private.mt_current_due(_now timestamptz) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT greatest(private.mt_first_due(),
                  ((_now AT TIME ZONE 'America/Chicago')::date
                   - ((extract(isodow FROM _now AT TIME ZONE 'America/Chicago')::int - 4 + 7) % 7)))
$$;

CREATE OR REPLACE FUNCTION public.weekly_scorecard(_due date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _lead boolean := private.mt_is_lead(_me);
  _d date := coalesce(_due, private.mt_current_due(now()));
  _latest public.scorecard_records;
  _last_sub public.scorecard_records;
  _opened boolean;
  _locked boolean;
BEGIN
  IF NOT (_lead OR private.mt_is_finance(_me)) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor, the Director of Operations, the COO, Admin and Finance open this.';
  END IF;
  IF extract(isodow FROM _d) <> 4 OR _d < private.mt_first_due() THEN RAISE EXCEPTION 'This weekly scorecard was not found.'; END IF;
  SELECT * INTO _latest FROM private.mt_weekly_events(_d) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1;
  SELECT * INTO _last_sub FROM private.mt_weekly_events(_d) e WHERE e.details ->> 'action' = 'submitted'
   ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1;
  _opened := now() >= private.mt_opens_at(_d);
  _locked := _latest.id IS NOT NULL AND _latest.details ->> 'action' <> 'returned';
  RETURN jsonb_build_object(
    'view', CASE WHEN _lead THEN 'lead' ELSE 'finance' END,
    'due_on', _d, 'from', _d - 7, 'to', _d - 1, 'opens_at', private.mt_opens_at(_d), 'due_at', private.mt_due_at(_d),
    'opened', _opened, 'status', private.mt_weekly_status(_d), 'on_time', private.mt_weekly_met(_d),
    'latest_action', _latest.details ->> 'action', 'locked', _locked,
    'facts', CASE WHEN _last_sub.id IS NOT NULL AND _locked THEN _last_sub.details -> 'facts'
                  WHEN _opened THEN private.mt_weekly_facts(_d) END,
    'manual', CASE WHEN NOT _lead THEN NULL
                   WHEN _locked THEN _last_sub.details -> 'manual'
                   ELSE coalesce((SELECT manual FROM public.weekly_scorecard_drafts WHERE due_on = _d),
                                 _last_sub.details -> 'manual', '{}'::jsonb) END,
    'return_note', CASE WHEN _lead AND _latest.details ->> 'action' = 'returned' THEN _latest.note END,
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('action', e.details ->> 'action', 'version', (e.details ->> 'version')::int,
                                 'at', e.recorded_at, 'by_name', (SELECT full_name FROM public.profiles WHERE id = e.recorded_by),
                                 'timing', e.details ->> 'timing', 'reason', CASE WHEN _lead THEN e.details ->> 'reason' END,
                                 'note', CASE WHEN _lead THEN e.note END) ORDER BY e.recorded_at, e.id)
                          FROM private.mt_weekly_events(_d) e), '[]'::jsonb),
    'can_edit', private.mt_is_sup(_me) AND _opened AND NOT _locked,
    'can_correct', private.mt_is_sup(_me) AND _locked,
    'can_decide', private.mt_is_dir(_me) AND _latest.details ->> 'action' = 'submitted' AND _latest.recorded_by IS DISTINCT FROM _me);
END $$;

CREATE OR REPLACE FUNCTION public.weekly_scorecard_weeks()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT (private.mt_is_lead(auth.uid()) OR private.mt_is_finance(auth.uid())) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor, the Director of Operations, the COO, Admin and Finance open this.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('due_on', d::date, 'status', private.mt_weekly_status(d::date),
             'on_time', private.mt_weekly_met(d::date),
             'latest_action', (SELECT e.details ->> 'action' FROM private.mt_weekly_events(d::date) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1))
             ORDER BY d DESC)
      FROM generate_series(private.mt_first_due(), greatest(private.mt_first_due(), private.mt_current_due(now())), interval '7 days') d), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.weekly_scorecard_save_draft(_due date, _manual jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _latest text;
BEGIN
  IF NOT private.mt_is_sup(auth.uid()) THEN RAISE EXCEPTION 'Only the Operations Supervisor fills the weekly scorecard.'; END IF;
  IF extract(isodow FROM _due) <> 4 OR _due < private.mt_first_due() THEN RAISE EXCEPTION 'This weekly scorecard was not found.'; END IF;
  IF now() < private.mt_opens_at(_due) THEN RAISE EXCEPTION 'This scorecard opens on Thursday.'; END IF;
  SELECT e.details ->> 'action' INTO _latest FROM private.mt_weekly_events(_due) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1;
  IF _latest IS NOT NULL AND _latest <> 'returned' THEN
    RAISE EXCEPTION 'This scorecard is submitted. Start a correction to change it.';
  END IF;
  IF jsonb_typeof(coalesce(_manual, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'The notes could not be read.'; END IF;
  INSERT INTO public.weekly_scorecard_drafts (due_on, manual, updated_by, updated_at)
  VALUES (_due, coalesce(_manual, '{}'::jsonb), auth.uid(), now())
  ON CONFLICT (due_on) DO UPDATE SET manual = EXCLUDED.manual, updated_by = EXCLUDED.updated_by, updated_at = now();
END $$;

-- Submit, resubmit after a return, or correct with a reason. Every version is a permanent fact.
CREATE OR REPLACE FUNCTION public.weekly_scorecard_submit(_due date, _manual jsonb, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _latest text;
  _version int;
  _reason_out text;
  _dir uuid;
  _id uuid;
BEGIN
  IF NOT private.mt_is_sup(_me) THEN RAISE EXCEPTION 'Only the Operations Supervisor submits the weekly scorecard.'; END IF;
  IF extract(isodow FROM _due) <> 4 OR _due < private.mt_first_due() THEN RAISE EXCEPTION 'This weekly scorecard was not found.'; END IF;
  IF now() < private.mt_opens_at(_due) THEN RAISE EXCEPTION 'This scorecard opens on Thursday.'; END IF;
  IF jsonb_typeof(coalesce(_manual, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'The notes could not be read.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('weekly_scorecard:' || _due));
  SELECT e.details ->> 'action' INTO _latest FROM private.mt_weekly_events(_due) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1;
  SELECT count(*) + 1 INTO _version FROM private.mt_weekly_events(_due) e WHERE e.details ->> 'action' = 'submitted';
  IF _latest IS NULL THEN
    _reason_out := NULL;
  ELSIF _latest = 'returned' THEN
    _reason_out := coalesce(nullif(btrim(coalesce(_reason, '')), ''), 'Sent again after it was returned');
  ELSE
    IF length(btrim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'Write the reason for the correction.'; END IF;
    _reason_out := btrim(_reason);
  END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, details)
  VALUES ('weekly_submission', _me, jsonb_build_object(
    'action', 'submitted', 'due_on', _due, 'version', _version,
    'timing', CASE WHEN now() <= private.mt_due_at(_due) THEN 'on_time' ELSE 'late' END,
    'reason', left(_reason_out, 1000), 'facts', private.mt_weekly_facts(_due), 'manual', coalesce(_manual, '{}'::jsonb)))
  RETURNING id INTO _id;
  INSERT INTO public.weekly_scorecard_drafts (due_on, manual, updated_by, updated_at)
  VALUES (_due, coalesce(_manual, '{}'::jsonb), _me, now())
  ON CONFLICT (due_on) DO UPDATE SET manual = EXCLUDED.manual, updated_by = EXCLUDED.updated_by, updated_at = now();
  _dir := public.seat_holder_at('director_ops', now());
  IF _dir IS NOT NULL AND _dir <> _me THEN
    PERFORM public.notify_staff(_dir, 'weekly_scorecard_submitted', 'Weekly scorecard submitted by the Operations Supervisor. Review it.',
      'The week through ' || to_char(_due - 1, 'Mon FMDD') || '.', 'weekly_scorecard', _id, '/weekly-scorecard?due=' || _due,
      NULL, _me, false, false);
  END IF;
  RETURN jsonb_build_object('id', _id, 'version', _version, 'status', private.mt_weekly_status(_due));
END $$;

CREATE OR REPLACE FUNCTION public.weekly_scorecard_decide(_due date, _reviewed boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  l public.scorecard_records;
  _sup uuid;
BEGIN
  IF NOT private.mt_is_dir(_me) THEN RAISE EXCEPTION 'Only the Director of Operations reviews the weekly scorecard.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('weekly_scorecard:' || _due));
  SELECT * INTO l FROM private.mt_weekly_events(_due) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1;
  IF l.id IS NULL OR l.details ->> 'action' <> 'submitted' THEN RAISE EXCEPTION 'There is no new submission to review.'; END IF;
  IF l.recorded_by = _me THEN RAISE EXCEPTION 'Nobody reviews their own scorecard.'; END IF;
  IF _reviewed IS NULL THEN RAISE EXCEPTION 'Choose Reviewed or Return.'; END IF;
  IF NOT _reviewed AND length(btrim(coalesce(_note, ''))) < 3 THEN RAISE EXCEPTION 'Add a note about what to fix.'; END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, refers_to, note, details)
  VALUES ('weekly_submission', _me, l.id, nullif(left(btrim(coalesce(_note, '')), 2000), ''),
          jsonb_build_object('action', CASE WHEN _reviewed THEN 'reviewed' ELSE 'returned' END, 'due_on', _due,
                             'version', (l.details ->> 'version')::int));
  IF NOT _reviewed THEN
    _sup := l.recorded_by;
    PERFORM public.notify_staff(_sup, 'weekly_scorecard_returned', 'Your weekly scorecard was returned. Fix it and submit again.',
      left(btrim(_note), 300), 'weekly_scorecard', l.id, '/weekly-scorecard?due=' || _due, NULL, _me, false, false);
  END IF;
END $$;

-- 7. Settings for the three trackers (the Director of Operations, the COO, the CEO and Admin).
CREATE OR REPLACE FUNCTION public.manual_tracker_save_settings(_key text, _value jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _before jsonb;
  _after jsonb;
  k text;
BEGIN
  IF NOT private.mt_can_set(_me) THEN
    RAISE EXCEPTION 'Only the Director of Operations, the COO, the CEO or Admin change this.';
  END IF;
  IF _key = 'team_records_settings' THEN
    IF coalesce((_value ->> 'per_coordinator')::int, -1) NOT BETWEEN 1 AND 20
       OR coalesce((_value ->> 'director_checks')::int, -1) NOT BETWEEN 1 AND 50 THEN
      RAISE EXCEPTION 'Choose 1 to 20 records a coordinator and 1 to 50 double checks.';
    END IF;
    _after := jsonb_build_object('per_coordinator', (_value ->> 'per_coordinator')::int, 'director_checks', (_value ->> 'director_checks')::int);
  ELSIF _key = 'coaching_settings' THEN
    IF coalesce((_value ->> 'per_month')::int, -1) NOT BETWEEN 0 AND 10 THEN RAISE EXCEPTION 'Choose 0 to 10 sessions a month.'; END IF;
    IF jsonb_typeof(coalesce(_value -> 'per_coordinator', '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'The coordinator counts could not be read.'; END IF;
    FOR k IN SELECT jsonb_object_keys(coalesce(_value -> 'per_coordinator', '{}'::jsonb)) LOOP
      IF coalesce((_value -> 'per_coordinator' ->> k)::int, -1) NOT BETWEEN 0 AND 10 THEN RAISE EXCEPTION 'Choose 0 to 10 sessions a month.'; END IF;
    END LOOP;
    _after := jsonb_build_object('per_month', (_value ->> 'per_month')::int, 'per_coordinator', coalesce(_value -> 'per_coordinator', '{}'::jsonb));
  ELSE
    RAISE EXCEPTION 'Unknown setting.';
  END IF;
  SELECT value INTO _before FROM public.app_settings WHERE key = _key;
  INSERT INTO public.app_settings (key, value, updated_by, updated_at) VALUES (_key, _after, _me, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_label, before_value, after_value)
  VALUES (_me, 'manual_tracker_setting_changed', 'setting', _key, _before, _after);
  RETURN _after;
END $$;

-- 8. Needs you now.
CREATE OR REPLACE FUNCTION public.trackers_waiting()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
  _out jsonb := '[]'::jsonb;
  _w date := private.mt_monday(now());
  _left int;
  _all int;
  _due date := private.mt_current_due(now());
  _act text;
  r record;
BEGIN
  IF _me IS NULL THEN RETURN _out; END IF;
  IF private.mt_is_sup(_me) THEN
    SELECT count(*) FILTER (WHERE (private.mt_review_of(d.id)).id IS NULL), count(*) FILTER (WHERE true) INTO _left, _all
      FROM public.team_record_draws d WHERE d.week_start = _w;
    IF _left > 0 THEN
      _out := _out || jsonb_build_array(jsonb_build_object('kind', 'records', 'title',
                'Team records: ' || _left || ' of ' || _all || ' left to review this week', 'link', '/team-records'));
    END IF;
    IF now() >= private.mt_opens_at(_due) THEN
      SELECT e.details ->> 'action' INTO _act FROM private.mt_weekly_events(_due) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1;
      IF _act = 'returned' THEN
        _out := _out || jsonb_build_array(jsonb_build_object('kind', 'weekly_returned', 'title',
                  'Your weekly scorecard was returned. Fix it and submit again.', 'link', '/weekly-scorecard', 'due_on', _due));
      ELSIF _act IS NULL THEN
        _out := _out || jsonb_build_array(jsonb_build_object('kind', 'weekly_due', 'title',
                  'Weekly scorecard due ' || to_char(_due, 'Dy, Mon FMDD') || ' at 3 PM. Check it and submit.', 'link', '/weekly-scorecard', 'due_on', _due));
      END IF;
    END IF;
  END IF;
  IF private.mt_is_dir(_me) THEN
    FOR r IN SELECT d::date AS due FROM generate_series(private.mt_first_due(), greatest(private.mt_first_due(), _due), interval '7 days') d LOOP
      SELECT e.details ->> 'action' INTO _act FROM private.mt_weekly_events(r.due) e ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1;
      IF _act = 'submitted' THEN
        _out := _out || jsonb_build_array(jsonb_build_object('kind', 'weekly_submitted', 'title',
                  'Weekly scorecard submitted by the Operations Supervisor. Review it.', 'link', '/weekly-scorecard', 'due_on', r.due));
      END IF;
    END LOOP;
    FOR r IN SELECT p.week_start, count(*) AS n FROM public.team_record_check_picks p
               WHERE NOT EXISTS (SELECT 1 FROM public.scorecard_records c WHERE c.kind = 'records_check_review' AND c.refers_to = p.review_id)
               GROUP BY p.week_start ORDER BY p.week_start LOOP
      _out := _out || jsonb_build_array(jsonb_build_object('kind', 'double_check', 'title',
                'Double check ' || r.n || ' of the Operations Supervisor''s record reviews', 'link', '/team-records', 'week_start', r.week_start));
    END LOOP;
  END IF;
  RETURN _out;
END $$;

-- 9. The Build 13 engine now reads these facts: clean records, team clean records, the weekly
--    report and coaching against the required sessions. Everything else in it is unchanged.
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
    -- Build 14 (G3): each active coordinator needs their required sessions in the period (the
    -- Coaching setting, default 1 a month); onboarding coaching counts. Session date, not save time.
    RETURN QUERY
    SELECT 'coaching:' || p.user_id || ':' || n.i, 'Coaching for ' || coalesce(pr.full_name, 'a coordinator')
             || CASE WHEN private.mt_coaching_required(p.user_id) > 1 THEN ', session ' || n.i ELSE '' END, _to,
           (SELECT count(*) FROM public.scorecard_records c
             WHERE c.kind = 'coaching_cycle' AND c.recorded_by = _user AND c.about_user_id = p.user_id AND NOT c.is_demo
               AND coalesce((c.details ->> 'session_on')::date, (c.recorded_at AT TIME ZONE 'America/Chicago')::date)
                   BETWEEN (_from AT TIME ZONE 'America/Chicago')::date AND _today) >= n.i, NULL::numeric
      FROM public.bonus_participants p
      LEFT JOIN public.profiles pr ON pr.id = p.user_id
      CROSS JOIN LATERAL generate_series(1, private.mt_coaching_required(p.user_id)) n(i)
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

  -- Build 14 (BN7, G2): Team records reviews. The Director's Disagree on the double check wins.
  IF _key IN ('pc_clean_records', 'team_clean_records') THEN
    RETURN QUERY
    SELECT 'review:' || r.id, coalesce(r.details ->> 'label', 'Record'), r.recorded_at, private.mt_final_clean(r.id), NULL::numeric
      FROM public.scorecard_records r
     WHERE r.kind = 'records_check' AND r.details ->> 'action' = 'review' AND NOT r.is_demo
       AND NOT coalesce(r.about_imported_ticket, false)
       AND r.recorded_at > _from AND r.recorded_at <= _to
       AND (_key <> 'pc_clean_records' OR r.details ->> 'owner_id' = _user::text);
  END IF;

  -- Build 14 (BN9, G4): one weekly scorecard due each Thursday 3 PM Central from the first due date.
  IF _key = 'weekly_report' THEN
    RETURN QUERY
    SELECT 'weekly:' || d::date, 'Weekly scorecard due ' || to_char(d, 'Mon FMDD'), private.mt_due_at(d::date),
           private.mt_weekly_met(d::date), NULL::numeric
      FROM generate_series(private.mt_first_due(), (_to AT TIME ZONE 'America/Chicago')::date, interval '7 days') d
     WHERE private.mt_due_at(d::date) > _from AND private.mt_due_at(d::date) <= _to;
  END IF;
END $$;

-- Every automatic measure now has its records (Build 14).
CREATE OR REPLACE FUNCTION private.bonus_measure_built(_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT _key IS NOT NULL
$$;

-- 10. Who may call what.
REVOKE ALL ON FUNCTION private.mt_is_sup(uuid), private.mt_is_dir(uuid), private.mt_is_lead(uuid), private.mt_can_set(uuid),
  private.mt_is_finance(uuid), private.mt_setting(text), private.mt_coaching_required(uuid), private.mt_first_due(),
  private.mt_due_at(date), private.mt_opens_at(date), private.mt_monday(timestamptz), private.mt_checklist_keys(),
  private.mt_candidates(date), private.mt_draw(date), private.mt_draw_one(public.team_record_draws), private.mt_review_of(uuid),
  private.mt_final_clean(uuid), private.mt_pick_checks(date), private.mt_sweep(timestamptz), private.mt_week_items(date, boolean),
  private.mt_session_on(public.scorecard_records), private.mt_session_json(public.scorecard_records),
  private.mt_count(text, uuid, timestamptz, timestamptz), private.mt_urgent(uuid, timestamptz, timestamptz),
  private.mt_weekly_facts(date), private.mt_weekly_events(date), private.mt_weekly_met(date), private.mt_weekly_status(date),
  private.mt_current_due(timestamptz)
  FROM PUBLIC, anon, authenticated;
-- The table read policies call this one.
GRANT EXECUTE ON FUNCTION private.mt_is_lead(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.team_records_week(date), public.team_records_weeks(),
  public.team_records_review(uuid, boolean, jsonb, text, text), public.team_records_skip(uuid, text),
  public.team_records_double_check(uuid, boolean, text), public.team_records_mine(),
  public.coaching_save_session(uuid, date, text, text[], text, text, jsonb, date), public.coaching_log(date),
  public.weekly_scorecard(date), public.weekly_scorecard_weeks(), public.weekly_scorecard_save_draft(date, jsonb),
  public.weekly_scorecard_submit(date, jsonb, text), public.weekly_scorecard_decide(date, boolean, text),
  public.manual_tracker_save_settings(text, jsonb), public.trackers_waiting()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_records_week(date), public.team_records_weeks(),
  public.team_records_review(uuid, boolean, jsonb, text, text), public.team_records_skip(uuid, text),
  public.team_records_double_check(uuid, boolean, text), public.team_records_mine(),
  public.coaching_save_session(uuid, date, text, text[], text, text, jsonb, date), public.coaching_log(date),
  public.weekly_scorecard(date), public.weekly_scorecard_weeks(), public.weekly_scorecard_save_draft(date, jsonb),
  public.weekly_scorecard_submit(date, jsonb, text), public.weekly_scorecard_decide(date, boolean, text),
  public.manual_tracker_save_settings(text, jsonb), public.trackers_waiting()
  TO authenticated;

-- 11. The Monday 6 AM Central draw (11:05 and 12:05 UTC cover both clock seasons; a second run adds nothing).
SELECT cron.schedule('team-records-draw', '5 11,12 * * 1', 'SELECT private.mt_sweep(now())');
