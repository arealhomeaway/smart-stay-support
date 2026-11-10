-- Practice for Build 13, run once on the real database and cancelled on purpose (nothing kept).
-- It moves the Operations Supervisor plan back to October 2026 inside the practice only, so a closed
-- period exists, then walks the whole chain as the real role holders: reviewer entries, a COO
-- approval, Verify, Finance, the person's question, a blocked outsider, a reopen and the close sweep.
DO $$
DECLARE
  _admin uuid := public.seat_holder_at('coo', now());
  _dir uuid := public.seat_holder_at('director_ops', now());
  _sup uuid := public.seat_holder_at('ops_supervisor', now());
  _fin uuid := public.seat_holder_at('finance_lead', now());
  _pc uuid := public.seat_holder_at('po_day', now());
  _card jsonb; _fact text; _goal uuid; _sysgoal uuid; _adj1 uuid; _adj2 uuid; _v jsonb; _pay jsonb; _pc_err text;
  _fin_before jsonb; _sweep jsonb; _hist int; _out jsonb := '{}'::jsonb; _q uuid; _settings_err text;
BEGIN
  UPDATE public.bonus_plans SET counting_start = '2026-10-01' WHERE code = 'ops_supervisor';
  UPDATE public.bonus_participants SET eligible_from = '2026-10-01' WHERE plan_code = 'ops_supervisor';

  -- The Director of Operations reviews the Supervisor.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _dir, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _dir::text, true);
  _card := public.bonus_scorecard('ops_supervisor', _sup, '2026-10-01');
  _out := _out || jsonb_build_object('live_before', jsonb_build_object('total', _card -> 'total', 'counted', _card -> 'counted_goals',
            'goals', (SELECT jsonb_agg(jsonb_build_object('name', e ->> 'name', 'status', e ->> 'status', 'value', e -> 'value',
                      'level', e ->> 'level', 'dollars', e -> 'dollars', 'facts', e -> 'fact_count')) FROM jsonb_array_elements(_card -> 'goals') e)));
  SELECT (e ->> 'goal_id')::uuid, e -> 'facts' -> 0 ->> 'key' INTO _goal, _fact
    FROM jsonb_array_elements(_card -> 'goals') e WHERE e ->> 'code' = 'team_follow_through';
  SELECT (e ->> 'goal_id')::uuid INTO _sysgoal FROM jsonb_array_elements(_card -> 'goals') e WHERE e ->> 'code' = 'weekly_report';
  PERFORM public.bonus_enter_measure('ops_supervisor', _sup, '2026-10-01', _sysgoal, 100, 'Practice: weekly reports all on time', NULL);
  IF _fact IS NOT NULL THEN
    _adj1 := public.bonus_request_adjustment('ops_supervisor', _sup, '2026-10-01', _goal, 'excused', _fact, 'Practice: approved leave that day');
  END IF;
  _adj2 := public.bonus_request_adjustment('ops_supervisor', _sup, '2026-10-01', _goal, 'system_problem', NULL, 'Practice: tracking outage');
  BEGIN
    PERFORM public.bonus_verify('ops_supervisor', _sup, '2026-10-01');
  EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('verify_while_waiting', SQLERRM);
  END;

  -- The COO approves the requests.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _admin::text, true);
  IF _adj1 IS NOT NULL THEN PERFORM public.bonus_decide_adjustment(_adj1, true, 'Practice approval'); END IF;
  PERFORM public.bonus_decide_adjustment(_adj2, true, 'Practice approval');

  -- Finance before Verify.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _fin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _fin::text, true);
  _fin_before := public.bonus_payouts();

  -- The Director verifies.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _dir, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _dir::text, true);
  _v := public.bonus_verify('ops_supervisor', _sup, '2026-10-01');
  _card := public.bonus_scorecard('ops_supervisor', _sup, '2026-10-01');
  _out := _out || jsonb_build_object('verified', _v, 'after_verify', jsonb_build_object('status', _card ->> 'status', 'total', _card -> 'total',
            'goals', (SELECT jsonb_agg(jsonb_build_object('name', e ->> 'name', 'status', e ->> 'status', 'value', e -> 'value',
                      'level', e ->> 'level', 'dollars', e -> 'dollars', 'system_problem', e -> 'system_problem')) FROM jsonb_array_elements(_card -> 'goals') e)));
  BEGIN
    PERFORM public.bonus_enter_measure('ops_supervisor', _sup, '2026-10-01', _sysgoal, 50, 'Practice: should be refused', NULL);
  EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('edit_after_verify', SQLERRM);
  END;

  -- Finance after Verify.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _fin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _fin::text, true);
  _pay := public.bonus_payouts();
  _out := _out || jsonb_build_object('finance_before_rows', jsonb_array_length(_fin_before),
            'finance_after', (SELECT jsonb_agg(jsonb_build_object('status', r ->> 'status', 'total', r -> 'total', 'verified_by', r -> 'verified_by'))
                               FROM jsonb_array_elements(_pay) r));
  BEGIN
    PERFORM public.bonus_settings();
  EXCEPTION WHEN OTHERS THEN _settings_err := SQLERRM;
  END;
  _out := _out || jsonb_build_object('finance_opens_settings', coalesce(_settings_err, 'allowed'));

  -- The Supervisor reads their own and raises a question.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _sup, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _sup::text, true);
  _card := public.bonus_scorecard('ops_supervisor', _sup, '2026-10-01');
  _q := public.bonus_raise_question('ops_supervisor', '2026-10-01', 'Practice: why is week two missing?');
  _out := _out || jsonb_build_object('own_view', jsonb_build_object('total', _card -> 'total', 'can_raise_question', _card -> 'can_raise_question',
            'closes', _card -> 'question_window_closes', 'pays_on', _card -> 'pays_on'));
  BEGIN
    PERFORM public.bonus_verify('ops_supervisor', _sup, '2026-10-01');
  EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('self_verify', SQLERRM);
  END;

  -- A coordinator cannot see the Supervisor's bonus.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _pc, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _pc::text, true);
  BEGIN
    PERFORM public.bonus_scorecard('ops_supervisor', _sup, '2026-10-01');
  EXCEPTION WHEN OTHERS THEN _pc_err := SQLERRM;
  END;
  _out := _out || jsonb_build_object('coordinator_sees_supervisor', coalesce(_pc_err, 'ALLOWED'),
            'coordinator_my_plans', public.bonus_my_plans(), 'coordinator_people', public.bonus_people());

  -- The COO reopens with a reason; the history keeps both versions.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _admin::text, true);
  PERFORM public.bonus_answer_question(_q, 'Practice answer');
  PERFORM public.bonus_reopen('ops_supervisor', _sup, '2026-10-01', 'Practice: correcting a record');
  SELECT count(*) INTO _hist FROM public.bonus_period_history h JOIN public.bonus_periods b ON b.id = h.period_id
   WHERE b.plan_code = 'ops_supervisor' AND b.user_id = _sup AND b.period_start = '2026-10-01';
  _out := _out || jsonb_build_object('history_rows_after_reopen', _hist,
            'settings_log_rows', (SELECT count(*) FROM public.bonus_settings_history));

  -- The close sweep, as if it were Dec 2: the November period has closed, so the Director gets one
  -- item; a second run adds nothing; 3 days later one reminder goes out.
  _sweep := private.bonus_sweep(now() + interval '22 days');
  _out := _out || jsonb_build_object('sweep_dec_2', _sweep, 'sweep_again', private.bonus_sweep(now() + interval '22 days'),
            'sweep_dec_5', private.bonus_sweep(now() + interval '25 days'),
            'reviewer_items', (SELECT jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'to_director', n.user_id = _dir))
                                 FROM public.staff_notifications n WHERE n.kind IN ('bonus_ready', 'bonus_ready_reminder')
                                  AND n.created_at >= now() - interval '1 minute'));

  RAISE EXCEPTION 'PRACTICE RESULT (cancelled on purpose): %', _out::text;
END $$;
