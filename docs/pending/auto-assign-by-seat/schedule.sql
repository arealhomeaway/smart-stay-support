SELECT cron.schedule('auto-assign-by-seat-20261126', '0 14 26 11 *', $job$
DO $spread$
DECLARE
  t record;
  r record;
  assigned jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
  target timestamptz := '2026-11-26 14:00:00+00';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auto-assign-by-seat-20261126'));
  IF now() >= target AND now() < target + interval '1 day'
     AND NOT EXISTS (SELECT 1 FROM public.audit_log
       WHERE action='ticket_assignment_spread' AND entity_label='auto-assign-by-seat-20261126') THEN
    FOR t IN
      SELECT * FROM public.tickets
      WHERE status IN ('open','dispatched','in_progress','waiting','awaiting_guest')
        AND archived_at IS NULL AND NOT is_demo AND import_hold IS NULL
        AND lower(coalesce(external_source,'')) <> 'notion'
        AND created_at >= '2026-11-16 00:00:00 America/Chicago'::timestamptz
        AND created_at < target
        AND assigned_to IS NULL AND current_action_owner IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.arrival_checks a
          WHERE a.ticket_id = tickets.id OR a.issue_ticket_id = tickets.id)
      ORDER BY created_at, id FOR UPDATE
    LOOP
      -- Each call is a separate statement so it sees all preceding assignments.
      SELECT * INTO r FROM public.ticket_route_at(
        CASE WHEN lower(coalesce(t.external_source,''))='breezeway'
               AND t.functional_role_code IS NULL AND t.work_type_id IS NULL
             THEN 'po_day' ELSE t.functional_role_code END, t.work_type_id, now());
      IF r.user_id IS NOT NULL THEN
        UPDATE public.tickets SET assigned_to=r.user_id, current_action_owner=r.user_id,
          assignment_source=r.source, assignment_note=r.note WHERE id=t.id;
        assigned := assigned || jsonb_build_array(jsonb_build_object('id',t.id,
          'assigned_to',r.user_id,'source',r.source,'note',r.note,
          'previous_assigned_to',t.assigned_to,'previous_current_action_owner',t.current_action_owner,
          'previous_assignment_source',t.assignment_source,'previous_assignment_note',t.assignment_note));
      ELSE
        skipped := skipped || jsonb_build_array(jsonb_build_object('id',t.id,'reason',r.note));
      END IF;
    END LOOP;
    INSERT INTO public.audit_log(actor_label,action,entity_type,entity_label,reason,after_value)
    VALUES ('Admin','ticket_assignment_spread','tickets','auto-assign-by-seat-20261126',
      'Approved one-time assignment at 8 AM Central.',
      jsonb_build_object('scheduled_at',target,'assigned',assigned,'skipped',skipped));
  END IF;
  PERFORM cron.unschedule('auto-assign-by-seat-20261126');
END;
$spread$;
$job$);
