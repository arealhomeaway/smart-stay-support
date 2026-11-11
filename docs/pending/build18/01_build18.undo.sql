-- Undo for 01_build18.sql: restores the two bonus functions exactly as live before Build 18
-- (md5 of the function bodies: bonus_compute 6867858004942898aef3d63d446fd60c,
-- bonus_payouts 312ad97f3cbd370c4f7c6c7814c9035a) and removes the new read-only helper.
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

COMMENT ON FUNCTION private.bonus_pays_on(date) IS NULL;
DROP FUNCTION IF EXISTS public.can_bulk_edit_home_tasks(uuid);
