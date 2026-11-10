-- Practice for Build 14, run once on the real database and cancelled on purpose (nothing kept).
-- It draws the Mon Nov 16 week from the real work of Nov 9 to 15 (1 record a coordinator, so the
-- week can be finished), reviews, skips, double checks, records a coaching session, and walks a
-- weekly scorecard through Submit, Return, resubmit, Reviewed and a correction, as the real role
-- holders. Then it reads the Supervisor's bonus goals and every role's view.
DO $$
DECLARE
  _dir uuid := public.seat_holder_at('director_ops', now());
  _sup uuid := public.seat_holder_at('ops_supervisor', now());
  _fin uuid := public.seat_holder_at('finance_lead', now());
  _coo uuid := public.seat_holder_at('coo', now());
  _pc uuid := public.seat_holder_at('po_day', now());
  _out jsonb := '{}'::jsonb;
  _w jsonb; _n int; _ids uuid[]; _i int := 0; d record; _due date := '2026-11-05'; _card jsonb; _e text;
  _reviews uuid[];
BEGIN
  UPDATE public.app_settings SET value = '{"per_coordinator": 1, "director_checks": 5}' WHERE key = 'team_records_settings';
  UPDATE public.app_settings SET value = jsonb_build_object('first_due', _due) WHERE key = 'weekly_scorecard_settings';
  _out := _out || jsonb_build_object('candidates', (SELECT count(*) FROM private.mt_candidates('2026-11-16')),
                                     'drawn', private.mt_draw('2026-11-16'), 'drawn_again', private.mt_draw('2026-11-16'));

  -- The Operations Supervisor reviews: the first Not clean, the last skipped, the rest Clean.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _sup, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _sup::text, true);
  SELECT array_agg(id ORDER BY draw_no) INTO _ids FROM public.team_record_draws WHERE week_start = '2026-11-16';
  IF cardinality(_ids) > 0 THEN
    BEGIN
      PERFORM public.team_records_review(_ids[1], false, '{"notes_complete": true}'::jsonb, 'Practice: no proof', NULL);
    EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('not_clean_without_link', SQLERRM);
    END;
    PERFORM public.team_records_review(_ids[1], false, '{"notes_complete": true}'::jsonb, 'Practice: no proof', 'https://example.com/proof');
    IF cardinality(_ids) > 1 THEN
      _out := _out || jsonb_build_object('skip', public.team_records_skip(_ids[cardinality(_ids)], 'Practice: the record cannot be opened'));
    END IF;
    FOR d IN SELECT id FROM public.team_record_draws WHERE week_start = '2026-11-16'
              AND (private.mt_review_of(id)).id IS NULL LOOP
      PERFORM public.team_records_review(d.id, true, '{"notes_complete": true, "guest_communication": true, "expenses_tracked": true,
        "handoff_ready": true, "proof_attached": true}'::jsonb, NULL, NULL);
    END LOOP;
  END IF;
  _w := public.team_records_week('2026-11-16');
  _out := _out || jsonb_build_object('supervisor_week', jsonb_build_object('total', _w -> 'total', 'reviewed', _w -> 'reviewed',
            'clean', _w -> 'clean', 'not_clean', _w -> 'not_clean', 'skipped', _w -> 'skipped', 'can_review', _w -> 'can_review'));
  _out := _out || jsonb_build_object('coaching_session', public.coaching_save_session(_pc, (now() AT TIME ZONE 'America/Chicago')::date,
            'check_in', ARRAY['Practice agenda'], 'Practice notes', 'Practice went well',
            jsonb_build_array(jsonb_build_object('text', 'Practice follow up', 'owner', 'coordinator',
                                                 'due_on', (now() AT TIME ZONE 'America/Chicago')::date + 7)), NULL) IS NOT NULL);
  _out := _out || jsonb_build_object('weekly_submit_1', public.weekly_scorecard_submit(_due,
            '{"wins": "Practice win"}'::jsonb, NULL));

  -- The Director of Operations double checks and returns the scorecard.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _dir, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _dir::text, true);
  _w := public.team_records_week('2026-11-16');
  _out := _out || jsonb_build_object('director_picked', _w -> 'picked', 'director_can_check', _w -> 'can_check',
            'waiting_director', public.trackers_waiting());
  SELECT array_agg((e ->> 'review_id')::uuid) INTO _reviews FROM jsonb_array_elements(_w -> 'items') e WHERE (e ->> 'picked')::boolean;
  IF cardinality(_reviews) > 0 THEN
    PERFORM public.team_records_double_check(_reviews[1], false, 'Practice: I disagree');
  END IF;
  PERFORM public.weekly_scorecard_decide(_due, false, 'Practice: add the urgent notes');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _sup, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _sup::text, true);
  _out := _out || jsonb_build_object('waiting_supervisor', public.trackers_waiting());
  PERFORM public.weekly_scorecard_submit(_due, '{"wins": "Practice win", "problems": "Practice notes added"}'::jsonb, NULL);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _dir, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _dir::text, true);
  PERFORM public.weekly_scorecard_decide(_due, true, NULL);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _sup, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _sup::text, true);
  BEGIN
    PERFORM public.weekly_scorecard_submit(_due, '{}'::jsonb, NULL);
  EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('correction_without_reason', SQLERRM);
  END;
  PERFORM public.weekly_scorecard_submit(_due, '{"wins": "Practice win, corrected"}'::jsonb, 'Practice: a wrong note');
  _card := public.weekly_scorecard(_due);
  _out := _out || jsonb_build_object('weekly', jsonb_build_object('status', _card -> 'status', 'locked', _card -> 'locked',
            'events', (SELECT jsonb_agg((e ->> 'action') || ':' || coalesce(e ->> 'version', '')) FROM jsonb_array_elements(_card -> 'events') e),
            'coordinators_prefilled', jsonb_array_length(_card -> 'facts' -> 'coordinators')));

  -- Finance and a coordinator.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _fin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _fin::text, true);
  _w := public.team_records_week('2026-11-16');
  _card := public.weekly_scorecard(_due);
  _out := _out || jsonb_build_object('finance', jsonb_build_object('records_view', _w -> 'view', 'records_items', jsonb_array_length(_w -> 'items'),
            'not_clean', _w -> 'not_clean', 'weekly_manual', _card -> 'manual',
            'weekly_has_notes', (_card::text LIKE '%Practice: a wrong note%' OR _card::text LIKE '%Practice win%')));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _pc, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _pc::text, true);
  BEGIN
    PERFORM public.team_records_week('2026-11-16');
  EXCEPTION WHEN OTHERS THEN _e := SQLERRM;
  END;
  _out := _out || jsonb_build_object('coordinator_records_week', coalesce(_e, 'ALLOWED'),
            'coordinator_mine', public.team_records_mine() - 'items',
            'coordinator_coaching_view', public.coaching_log(NULL) -> 'view',
            'coordinator_coaching_sessions', jsonb_array_length(public.coaching_log(NULL) -> 'sessions'),
            'coordinator_waiting', public.trackers_waiting());

  -- The Supervisor's bonus goals read the new facts (counting moved to Nov 1 for the practice).
  UPDATE public.bonus_plans SET counting_start = '2026-11-01' WHERE code = 'ops_supervisor';
  UPDATE public.bonus_participants SET eligible_from = '2026-11-01' WHERE plan_code = 'ops_supervisor';
  UPDATE public.bonus_period_amounts SET period_start = '2026-11-01' WHERE plan_code = 'ops_supervisor' AND period_start = '2026-11-09';
  _card := private.bonus_compute('ops_supervisor', _sup, '2026-11-01', now() + interval '8 days');
  _out := _out || jsonb_build_object('engine', (SELECT jsonb_agg(jsonb_build_object('goal', e ->> 'code', 'status', e ->> 'status',
            'num', e -> 'numerator', 'den', e -> 'denominator', 'value', e -> 'value'))
            FROM jsonb_array_elements(_card -> 'goals') e WHERE e ->> 'code' IN ('team_clean_records', 'coaching', 'weekly_report')));

  RAISE EXCEPTION 'PRACTICE RESULT (cancelled on purpose): %', _out::text;
END $$;
