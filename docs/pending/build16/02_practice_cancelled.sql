-- Cancelled practice for Build 16 (run after 01_build16.sql in the same transaction; the final
-- RAISE cancels everything, so nothing is kept).
DO $$
DECLARE
  _live uuid; _quiet uuid; _wo uuid; _wo2 uuid;
  _step_live text; _step_quiet text; _lines int; _again int; _err text := 'none';
BEGIN
  SELECT id INTO _live FROM public.tickets WHERE archived_at IS NULL AND resolved_at IS NULL
     AND external_source = 'notion' ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO _quiet FROM public.tickets WHERE archived_at IS NULL AND resolved_at IS NULL
     AND external_source = 'notion' AND id <> _live ORDER BY created_at DESC LIMIT 1;
  -- Make one of them a live ticket for the practice (as if reopened in Resolve).
  UPDATE public.tickets SET external_status = 'reopened_in_resolve', next_action = NULL WHERE id = _live;
  SELECT id INTO _wo FROM public.breezeway_work_orders WHERE linked_ticket_id IS NULL
     AND lower(coalesce(status,'')) NOT IN ('finished','approved','closed') AND coalesce(stage,'') <> 'finished' LIMIT 1;
  SELECT id INTO _wo2 FROM public.breezeway_work_orders WHERE linked_ticket_id IS NULL AND id <> _wo
     AND lower(coalesce(status,'')) NOT IN ('finished','approved','closed') AND coalesce(stage,'') <> 'finished' LIMIT 1;

  UPDATE public.breezeway_work_orders SET linked_ticket_id = _live WHERE id = _wo;
  UPDATE public.breezeway_work_orders SET status = 'Finished', stage = 'finished' WHERE id = _wo;
  UPDATE public.breezeway_work_orders SET status = 'Finished', stage = 'finished' WHERE id = _wo; -- repeat: no second line
  UPDATE public.breezeway_work_orders SET linked_ticket_id = _quiet, status = 'Finished', stage = 'finished' WHERE id = _wo2;

  SELECT next_action INTO _step_live FROM public.tickets WHERE id = _live;
  SELECT next_action INTO _step_quiet FROM public.tickets WHERE id = _quiet;
  SELECT count(*) INTO _lines FROM public.ticket_activity WHERE ticket_id = _live AND event_type = 'breezeway_finished';
  SELECT count(*) INTO _again FROM public.ticket_state_log WHERE ticket_id = _live AND field = 'next_action' AND recorded_at >= now();

  BEGIN
    PERFORM public.save_direct_booking_settings('{}'::jsonb); -- no signed in caller: refused
  EXCEPTION WHEN others THEN _err := SQLERRM; END;

  RAISE EXCEPTION 'PRACTICE RESULT live_step=% quiet_step=% history_lines=% state_log=% flags_off=% settings_refusal=%',
    _step_live, coalesce(_step_quiet, 'unchanged'), _lines, _again,
    (SELECT count(*) FROM public.feature_flags WHERE key IN ('arrival_ready_button','finance_packet_button') AND NOT enabled),
    _err;
END $$;
