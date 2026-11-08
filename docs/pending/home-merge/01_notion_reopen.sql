-- Home and Team Queue: reopen or take a ticket imported from Notion.
-- Staged only. Not applied until approved. Undo: 01_undo_notion_reopen.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
-- Additive: one new function, one new trigger function and one new trigger.
-- No new columns. It uses existing ones: external_source, external_status,
-- import_hold, last_reopened_at and ticket_activity.

-- 1. Reopen (historical or older open) or take (recent open) a Notion import.
--    Makes it live, assigns it to the caller, starts clocks fresh from now and
--    writes one history line. Clock times come from the app's one clock rule
--    (slaDueDates) and are checked here so they can only start from now.
CREATE OR REPLACE FUNCTION public.reopen_notion_ticket(
  _ticket_id uuid, _reason text, _response_due_at timestamptz, _action_due_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _t public.tickets;
  _me uuid := auth.uid();
  _reason_clean text := btrim(coalesce(_reason, ''));
  _recent boolean;
  _line text;
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
  IF _t.external_source IS DISTINCT FROM 'notion' THEN
    RAISE EXCEPTION 'Only tickets imported from Notion are reopened here.';
  END IF;
  IF _t.external_status = 'reopened_in_resolve' THEN
    RAISE EXCEPTION 'This ticket is already live in Resolve.';
  END IF;
  IF _t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This ticket is archived.'; END IF;
  IF _t.import_hold = 'needs_home' THEN
    RAISE EXCEPTION 'Choose the home for this ticket first.';
  END IF;

  _recent := _t.status IN ('open','dispatched','in_progress','waiting','awaiting_guest')
             AND _t.reported_at > now() - interval '30 days';
  _line := CASE WHEN _recent THEN 'Taken from the Notion import' ELSE 'Reopened from Notion history' END;

  UPDATE public.tickets SET
    status = 'open',
    external_status = 'reopened_in_resolve',
    last_reopened_at = now(),
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
    import_hold = NULL
  WHERE id = _ticket_id;

  INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, is_demo, internal, to_owner)
  VALUES (_ticket_id, _me, 'status', 'reopened_from_notion', _line || '. Reason: ' || _reason_clean,
          _t.is_demo, true, _me);

  RETURN jsonb_build_object('ticket_id', _ticket_id, 'history', _line, 'reopened_at', now());
END $$;
REVOKE ALL ON FUNCTION public.reopen_notion_ticket(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_notion_ticket(uuid, text, timestamptz, timestamptz) TO authenticated;

-- 2. A Notion import rerun never undoes a reopening: while the import runs
--    (resolve.import_quiet = on), a reopened ticket keeps its Resolve values.
CREATE OR REPLACE FUNCTION public.keep_reopened_notion_ticket()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('resolve.import_quiet', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.keep_reopened_notion_ticket() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tickets_keep_reopened_notion BEFORE UPDATE ON public.tickets
  FOR EACH ROW WHEN (OLD.external_source = 'notion' AND OLD.external_status = 'reopened_in_resolve')
  EXECUTE FUNCTION public.keep_reopened_notion_ticket();
