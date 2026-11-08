-- Fix batch 1, part 2: Reopen any closed ticket. Staged only. Not applied until approved.
-- Undo: 02_undo_reopen_ticket.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- Adds public.reopen_ticket, the one step behind "Reopen this ticket" on a
-- closed ticket. It follows the applied Notion reopen (reopen_notion_ticket,
-- which stays exactly as it is and still handles imports that are not live yet):
--  - only staff who work tickets (admin, manager, tech); onboarding, owner and
--    vendor accounts are refused;
--  - a reason of 3 to 500 characters;
--  - fresh response and action times that start from now (worked out in the
--    app from the one clock rule, checked here);
--  - the ticket must be closed, not archived, and not a one touch log;
--  - an import not yet live in Resolve is refused here and goes through the
--    Notion reopen instead;
--  - in one step: the ticket becomes open, is assigned to the person who
--    reopened it, its clocks restart, the reopen count goes up by one, and a
--    history line with the reason is written. Earlier history and earlier
--    credit are never rewritten; only work after this moment belongs to the
--    person who reopened it.
-- Nothing else changes: priority, work type, team, receipt time, claims,
-- Work Orders and the existing reopen of resolved tickets stay as they are.

CREATE OR REPLACE FUNCTION public.reopen_ticket(
  _ticket_id uuid, _reason text, _response_due_at timestamptz, _action_due_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _t public.tickets;
  _me uuid := auth.uid();
  _reason_clean text := btrim(coalesce(_reason, ''));
BEGIN
  IF _me IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _me AND role::text IN ('admin','manager','tech')) THEN
    RAISE EXCEPTION 'Only staff who work tickets can reopen this ticket.';
  END IF;
  IF length(_reason_clean) < 3 THEN RAISE EXCEPTION 'Add a short reason.'; END IF;
  IF length(_reason_clean) > 500 THEN RAISE EXCEPTION 'Keep the reason under 500 characters.'; END IF;
  IF _response_due_at IS NULL OR _action_due_at IS NULL
     OR _response_due_at <= now() OR _action_due_at < _response_due_at
     OR _action_due_at > now() + interval '7 days' THEN
    RAISE EXCEPTION 'The new response times are not valid. Refresh and try again.';
  END IF;

  SELECT * INTO _t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This ticket was not found.'; END IF;
  IF _t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This ticket is archived.'; END IF;
  IF _t.external_source = 'notion' AND _t.external_status IS DISTINCT FROM 'reopened_in_resolve' THEN
    RAISE EXCEPTION 'Use Reopen in the Imported from Notion box on this ticket.';
  END IF;
  IF _t.record_type = 'completed_interaction' THEN
    RAISE EXCEPTION 'A one touch log cannot be reopened. Record new work instead.';
  END IF;
  IF _t.status IS DISTINCT FROM 'closed' THEN
    RAISE EXCEPTION 'Only a closed ticket can be reopened here.';
  END IF;

  UPDATE public.tickets SET
    status = 'open',
    last_reopened_at = now(),
    reopen_count = coalesce(reopen_count, 0) + 1,
    resolved_at = NULL,
    acknowledged_at = NULL,
    action_started_at = NULL,
    response_due_at = _response_due_at,
    action_due_at = _action_due_at,
    next_review_at = NULL,
    waiting_on = NULL,
    waiting_reason = NULL,
    escalation_level = 'none',
    handoff_status = 'none',
    pending_handoff_to = NULL,
    assigned_to = _me,
    current_action_owner = _me,
    record_owner = _me,
    accountable_owner = _me,
    assignment_source = 'manual',
    assignment_note = NULL
  WHERE id = _ticket_id;

  INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, is_demo, internal, to_owner)
  VALUES (_ticket_id, _me, 'reopened', 'reopened', 'Reopened. Reason: ' || _reason_clean,
          _t.is_demo, true, _me);

  RETURN jsonb_build_object('ticket_id', _ticket_id, 'history', 'Reopened', 'reopened_at', now());
END $$;

REVOKE ALL ON FUNCTION public.reopen_ticket(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_ticket(uuid, text, timestamptz, timestamptz) TO authenticated;
