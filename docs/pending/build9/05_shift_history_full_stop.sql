-- Build 9 C5 (STAGE ONLY, not marked APPLY): the End my shift history line gets its full stop.
-- Before: "Done so far: Called the vendor Next step: ..."  After: "Done so far: Called the vendor. Next step: ..."
-- One change in end_my_shift: the done so far text loses any trailing full stop or space and
-- gains exactly one. Everything else is byte for byte the live function.
-- Undo: undo/05_shift_history_full_stop.sql (the exact live text before Build 9).
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

CREATE OR REPLACE FUNCTION public.end_my_shift(_kind text, _at timestamp with time zone, _items jsonb, _nothing boolean, _demo boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_at timestamptz := greatest(now(), least(coalesce(_at, now()), now() + interval '16 hours'));
  v_kind text := coalesce(_kind, 'end_of_shift');
  v_items jsonb := coalesce(_items, '[]'::jsonb);
  v_item jsonb;
  v_t public.tickets%ROWTYPE;
  v_ticket uuid;
  v_ref text;
  v_to uuid;
  v_role text;
  v_to_role text;
  v_team text;
  v_my_team text;
  v_done text;
  v_next text;
  v_due timestamptz;
  v_label text;
  v_handoff uuid;
  v_record uuid;
  v_ticket_ids uuid[] := '{}';
  v_handoff_ids uuid[] := '{}';
  v_pick record;
  v_coord text[] := ARRAY['ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening'];
BEGIN
  IF v_me IS NULL OR NOT private.is_staff(v_me) THEN
    RAISE EXCEPTION 'Only the team can hand off work.';
  END IF;
  IF v_kind NOT IN ('end_of_shift', 'lunch') THEN
    RAISE EXCEPTION 'Unknown handoff.';
  END IF;
  IF jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'The list of tickets could not be read.';
  END IF;
  IF coalesce(_nothing, false) AND jsonb_array_length(v_items) > 0 THEN
    RAISE EXCEPTION 'Untick Nothing to hand off, or remove the tickets.';
  END IF;
  IF NOT coalesce(_nothing, false) AND jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Choose who gets each ticket, or tick Nothing to hand off.';
  END IF;

  SELECT CASE WHEN fr.code LIKE 'ge\_%' THEN 'guest_experience' ELSE 'property_operations' END
    INTO v_my_team
    FROM public.functional_roles fr
   WHERE fr.active AND fr.code = ANY (v_coord) AND public.seat_holder_at(fr.code, now()) = v_me
   ORDER BY fr.sort_order
   LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_ticket := nullif(v_item->>'ticket_id', '')::uuid;
    IF v_ticket IS NULL THEN
      RAISE EXCEPTION 'A ticket is missing from the list.';
    END IF;
    IF v_ticket = ANY (v_ticket_ids) THEN
      RAISE EXCEPTION 'A ticket is in the list twice.';
    END IF;

    SELECT * INTO v_t FROM public.tickets WHERE id = v_ticket FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A ticket in the list could not be found.';
    END IF;
    v_ref := coalesce('#' || v_t.ref::text, 'this ticket');
    IF v_t.archived_at IS NOT NULL OR v_t.status IN ('resolved', 'closed') THEN
      RAISE EXCEPTION 'Ticket % is no longer open. Refresh and try again.', v_ref;
    END IF;
    IF coalesce(v_t.is_demo, false) <> coalesce(_demo, false) THEN
      RAISE EXCEPTION 'Ticket % does not belong to this view.', v_ref;
    END IF;
    IF coalesce(v_t.current_action_owner, v_t.assigned_to, v_t.record_owner, v_t.accountable_owner) IS DISTINCT FROM v_me THEN
      RAISE EXCEPTION 'You no longer own ticket %. Refresh and try again.', v_ref;
    END IF;
    IF v_t.handoff_status = 'pending' THEN
      RAISE EXCEPTION 'Ticket % is already waiting for someone to accept it.', v_ref;
    END IF;
    IF coalesce(v_t.external_source, '') = 'notion' AND v_t.external_status IS DISTINCT FROM 'reopened_in_resolve' THEN
      RAISE EXCEPTION 'Ticket % is an imported ticket nobody has taken yet.', v_ref;
    END IF;

    v_done := btrim(coalesce(v_item->>'done', ''));
    v_next := btrim(coalesce(v_item->>'next_step', ''));
    v_due := nullif(v_item->>'due_at', '')::timestamptz;
    IF v_done = '' THEN RAISE EXCEPTION 'Write what is done so far on ticket %.', v_ref; END IF;
    IF v_next = '' THEN RAISE EXCEPTION 'Write the next step on ticket %.', v_ref; END IF;
    IF v_due IS NULL THEN RAISE EXCEPTION 'Choose when the next step on ticket % is due.', v_ref; END IF;
    IF length(v_done) > 2000 OR length(v_next) > 500 THEN
      RAISE EXCEPTION 'The note on ticket % is too long.', v_ref;
    END IF;

    v_team := CASE
      WHEN v_t.functional_role_code LIKE 'ge\_%' THEN 'guest_experience'
      WHEN v_t.functional_role_code LIKE 'po\_%' THEN 'property_operations'
      ELSE v_my_team END;

    -- Who gets it: a person, or a role that resolves to the person on shift in it.
    v_to := nullif(v_item->>'to_user', '')::uuid;
    v_role := nullif(v_item->>'to_role', '');
    v_to_role := NULL;
    IF v_to IS NULL AND v_role IS NOT NULL THEN
      IF v_role = 'coordinator' THEN
        IF v_team IS NOT NULL THEN
          SELECT * INTO v_pick FROM public.coordinator_for(v_team, v_at);
          IF v_pick.user_id IS NOT NULL AND v_pick.user_id <> v_me THEN
            v_to := v_pick.user_id; v_to_role := v_pick.role_code;
          END IF;
        END IF;
      ELSIF v_role = 'ops_supervisor' THEN
        v_to := public.seat_holder_at('ops_supervisor', v_at); v_to_role := 'ops_supervisor';
      ELSIF v_role = ANY (v_coord) THEN
        IF public.seat_eligible_now(v_role, v_at) AND public.staff_assignable(public.seat_holder_at(v_role, v_at))
           AND public.seat_holder_at(v_role, v_at) <> v_me THEN
          v_to := public.seat_holder_at(v_role, v_at); v_to_role := v_role;
        END IF;
      ELSE
        RAISE EXCEPTION 'Unknown role on ticket %.', v_ref;
      END IF;
      -- A role with nobody on shift goes to the Operations Supervisor (register T6).
      IF v_to IS NULL OR v_to = v_me THEN
        v_to := public.seat_holder_at('ops_supervisor', v_at); v_to_role := 'ops_supervisor';
      END IF;
    END IF;
    IF v_to IS NULL THEN
      RAISE EXCEPTION 'Choose who gets ticket %.', v_ref;
    END IF;
    IF v_to = v_me THEN
      RAISE EXCEPTION 'Choose someone else for ticket %.', v_ref;
    END IF;
    IF NOT private.is_staff(v_to) THEN
      RAISE EXCEPTION 'The person chosen for ticket % is not on the team.', v_ref;
    END IF;
    IF v_to_role IS NULL THEN
      SELECT fr.code INTO v_to_role FROM public.functional_roles fr
       WHERE fr.active AND fr.current_seat_holder = v_to ORDER BY fr.sort_order LIMIT 1;
      v_to_role := coalesce(v_to_role, v_t.functional_role_code);
    END IF;
    v_label := CASE
      WHEN v_to_role = ANY (v_coord) THEN 'the ' || public.coordinator_role_label(v_to_role)
      WHEN v_to_role = 'ops_supervisor' THEN 'the Operations Supervisor'
      ELSE 'a teammate' END;

    INSERT INTO public.handoffs(
      ticket_id, from_user, to_user, to_role_code, handoff_type, summary, priority,
      actions_completed, current_status, next_action, due_at, guest_comm_status, is_demo)
    VALUES (
      v_t.id, v_me, v_to, v_to_role, 'shift_coverage', coalesce(v_t.title, 'Ticket'), v_t.priority,
      v_done,
      CASE WHEN v_kind = 'lunch' THEN 'Handed off before lunch' ELSE 'Handed off at the end of a shift' END,
      v_next, v_due, 'not_required', coalesce(v_t.is_demo, false))
    RETURNING id INTO v_handoff;

    UPDATE public.tickets
       SET handoff_status = 'pending',
           pending_handoff_to = v_to,
           handoff_type = 'shift_coverage',
           handoff_note = coalesce(v_t.title, 'Ticket'),
           next_action = v_next
     WHERE id = v_t.id;

    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, from_owner, to_owner, is_demo)
    VALUES (
      v_t.id, v_me, 'handoff', 'handoff_requested',
      CASE WHEN v_kind = 'lunch' THEN 'Before lunch: handed to ' ELSE 'End of shift: handed to ' END
        || v_label || ' to accept. Done so far: ' || rtrim(v_done, '. ') || '. Next step: ' || v_next || ', due '
        || to_char(v_due AT TIME ZONE 'America/Chicago', 'Mon FMDD, FMHH12:MI AM')
        || '. It moves only when accepted; until then the sender still owns it.',
      v_me, v_to, coalesce(v_t.is_demo, false));

    v_ticket_ids := v_ticket_ids || v_t.id;
    v_handoff_ids := v_handoff_ids || v_handoff;
  END LOOP;

  INSERT INTO public.shift_end_records(user_id, kind, nothing_to_hand_off, ticket_ids, handoff_ids, is_demo)
  VALUES (v_me, v_kind, coalesce(_nothing, false), v_ticket_ids, v_handoff_ids, coalesce(_demo, false))
  RETURNING id INTO v_record;

  RETURN jsonb_build_object('record_id', v_record, 'handoffs', coalesce(array_length(v_handoff_ids, 1), 0));
END
$function$;
