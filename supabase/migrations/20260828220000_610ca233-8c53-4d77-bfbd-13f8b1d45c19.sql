-- Automatic ticket assignment from the existing ownership matrix.
--
-- NOT APPLIED. Prepared for review — an admin must run this against the live
-- database before the code that depends on the two new `tickets` columns is
-- deployed (see src/lib/matters.ts and src/components/MatterOwnershipPanel.tsx).
--
-- Context: `work_types.functional_role_code` already names which seat (SOP
-- role) owns each work type, and `functional_roles.current_seat_holder`
-- already names who currently holds each seat — both existed before this
-- migration, maintained today only through the admin Team page. Nothing
-- previously resolved the first into the second: ticket creation stamped
-- `functional_role_code` onto the ticket as a label only and then assigned
-- the ticket to whoever filed it. This migration adds no new ownership
-- rules — it only wires up the two that already exist.
--
-- Scope, deliberately narrow:
--   - Fires BEFORE INSERT only, never on UPDATE. This means it can never
--     overwrite a manual reassignment (src/components/MatterOwnershipPanel.tsx)
--     or a handoff acceptance (src/components/HandoffPanel.tsx) made after a
--     ticket exists — those always happen strictly after INSERT.
--   - Only sets `current_action_owner` and `assigned_to` (the working
--     assignee) — `record_owner`/`accountable_owner` are left exactly as the
--     client sets them (the filer stays accountable for having logged it).
--   - Skips tickets created already closed (one-touch resolutions never
--     enter the working queue, so there is nothing to route).
--   - Skips any work type flagged `pending_approval` — its ownership is not
--     finalized, so nothing is auto-assigned and the reason says so.
--   - Eligibility = the resolved seat holder must still hold one of the
--     staff roles the rest of the app already treats as assignable
--     (admin/manager/onboarding/tech — the exact set src/hooks/useTeam.ts
--     `useStaffDirectory()` already filters to), not just "a row exists."
--     A seat holder who has since lost that role is treated the same as an
--     empty seat.
--   - Vacant/ineligible primary seat falls back to `backup_role_code` (a
--     structured seat-to-seat pointer already on `functional_roles`) once.
--     If the backup seat is also vacant/ineligible, the ticket is left
--     unassigned with a reason — never assigned to an arbitrary person.
--     (`work_types.backup_coverage` is free text like "on-duty Property
--     Operations role during solo coverage" that depends on time-of-day /
--     day-of-week coverage windows that are themselves stored as free text
--     — nothing machine-readable exists to resolve that safely, so it is
--     deliberately not used here. Using it would mean inventing a coverage
--     schedule the SOP does not encode anywhere. Flagged as an open
--     decision, not silently guessed at.)
--   - Confirmed with the business (2026-08-28): system-created work with no
--     owning role recorded at all (`functional_role_code` unset on both the
--     ticket and its work type) routes to the Operations Supervisor seat
--     (`functional_roles.code = 'ops_supervisor'`, an existing row in the
--     ownership matrix, not invented here) instead of being left fully
--     unassigned. If that seat is itself vacant/ineligible, it still falls
--     back to the same visible-unassigned-with-reason state as everything
--     else — the Supervisor seat gets no unconditional catch-all beyond one
--     lookup.
--   - Deliberately NOT implemented here, pending clarification the business
--     has explicitly flagged as still open: schedule-aware seat selection
--     (day-of-week / time-block current holder, lunch coverage, single-PC
--     triage), overnight coverage (the SOP's stated operating window is
--     8 a.m.–10 p.m. Central), and the currently-vacant Evening/Weekend
--     Property Operations seat. `functional_roles.current_seat_holder` is
--     used as-is (today's holder, whoever that is) rather than resolving a
--     schedule, so a ticket created outside that seat's actual coverage
--     hours can still land on that name. Fixing this needs a decision on
--     how the approved schedule becomes machine-readable — not something to
--     guess at in this migration.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS assignment_source text,
  ADD COLUMN IF NOT EXISTS assignment_note text;

COMMENT ON COLUMN public.tickets.assignment_source IS
  'How current_action_owner/assigned_to got set: ''automatic'' (this trigger), ''manual'' (a supervisor or self-assignment), or NULL (never assigned).';
COMMENT ON COLUMN public.tickets.assignment_note IS
  'Human-readable reason for the current assignment state, most useful when NULL owner + a reason explains why nobody was auto-assigned.';

CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending_approval boolean;
  v_role_code text;
  v_holder uuid;
  v_holder_eligible boolean;
  v_role_name text;
  v_backup_code text;
  v_backup_holder uuid;
  v_backup_eligible boolean;
  v_backup_name text;
BEGIN
  -- Nothing to route for a record already closed at creation (one-touch
  -- resolutions never enter the working queue).
  IF NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  -- The work type's own pending_approval flag is authoritative: if the SOP
  -- itself hasn't finalized ownership for this work type, do not guess.
  IF NEW.work_type_id IS NOT NULL THEN
    SELECT pending_approval INTO v_pending_approval
    FROM public.work_types WHERE id = NEW.work_type_id;
  END IF;

  IF v_pending_approval THEN
    NEW.current_action_owner := NULL;
    NEW.assigned_to := NULL;
    NEW.assignment_source := NULL;
    NEW.assignment_note := 'Not auto-assigned: this work type''s ownership is still pending approval.';
    RETURN NEW;
  END IF;

  -- Use the role code as the form/creator resolved it (respects an explicit
  -- override of the work type's suggested role); fall back to the work
  -- type's own default only if none was set.
  v_role_code := NEW.functional_role_code;
  IF v_role_code IS NULL AND NEW.work_type_id IS NOT NULL THEN
    SELECT functional_role_code INTO v_role_code
    FROM public.work_types WHERE id = NEW.work_type_id;
  END IF;

  -- Unmatched/system-created work (no owning role recorded at all) routes to
  -- the Operations Supervisor seat (functional_roles.code = 'ops_supervisor',
  -- an existing seat in the ownership matrix, not one invented here) rather
  -- than being left fully unassigned, per the confirmed SOP rule that
  -- unknown work always has a named human to triage it.
  IF v_role_code IS NULL THEN
    v_role_code := 'ops_supervisor';

    SELECT fr.current_seat_holder, fr.name, fr.backup_role_code
      INTO v_holder, v_role_name, v_backup_code
    FROM public.functional_roles fr
    WHERE fr.code = v_role_code AND fr.active;

    v_holder_eligible := v_holder IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_holder AND ur.role::text IN ('admin', 'manager', 'onboarding', 'tech')
    );

    IF v_holder_eligible THEN
      NEW.current_action_owner := v_holder;
      NEW.assigned_to := v_holder;
      NEW.assignment_source := 'automatic';
      NEW.assignment_note := 'No owning role is recorded for this work type; routed to the Operations Supervisor for triage.';
      RETURN NEW;
    END IF;

    NEW.current_action_owner := NULL;
    NEW.assigned_to := NULL;
    NEW.assignment_source := NULL;
    NEW.assignment_note := 'Not auto-assigned: no owning role is recorded for this work type, and the Operations Supervisor seat has no eligible holder. Needs a manual assignment.';
    RETURN NEW;
  END IF;

  SELECT fr.current_seat_holder, fr.name, fr.backup_role_code
    INTO v_holder, v_role_name, v_backup_code
  FROM public.functional_roles fr
  WHERE fr.code = v_role_code AND fr.active;

  v_holder_eligible := v_holder IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_holder AND ur.role::text IN ('admin', 'manager', 'onboarding', 'tech')
  );

  IF v_holder_eligible THEN
    NEW.current_action_owner := v_holder;
    NEW.assigned_to := v_holder;
    NEW.assignment_source := 'automatic';
    NEW.assignment_note := 'Assigned via the ' || COALESCE(v_role_name, v_role_code) || ' seat.';
    RETURN NEW;
  END IF;

  -- Primary seat vacant or its holder no longer eligible — try the
  -- structured backup seat once.
  IF v_backup_code IS NOT NULL THEN
    SELECT fr.current_seat_holder, fr.name
      INTO v_backup_holder, v_backup_name
    FROM public.functional_roles fr
    WHERE fr.code = v_backup_code AND fr.active;

    v_backup_eligible := v_backup_holder IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_backup_holder AND ur.role::text IN ('admin', 'manager', 'onboarding', 'tech')
    );

    IF v_backup_eligible THEN
      NEW.current_action_owner := v_backup_holder;
      NEW.assigned_to := v_backup_holder;
      NEW.assignment_source := 'automatic';
      NEW.assignment_note := 'Primary seat (' || COALESCE(v_role_name, v_role_code)
        || ') has no eligible holder; assigned via its backup seat ' || COALESCE(v_backup_name, v_backup_code) || '.';
      RETURN NEW;
    END IF;
  END IF;

  -- No eligible assignee anywhere in the chain: visible unassigned state
  -- plus a reason, never an arbitrary person.
  NEW.current_action_owner := NULL;
  NEW.assigned_to := NULL;
  NEW.assignment_source := NULL;
  NEW.assignment_note := 'No eligible staff currently hold the ' || COALESCE(v_role_name, v_role_code)
    || ' seat or its backup. Needs a manual assignment.';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tickets_auto_assign ON public.tickets;
CREATE TRIGGER tickets_auto_assign
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_ticket();

-- Record the automatic assignment (or the lack of one) in both existing
-- audit surfaces — the visible per-ticket activity feed, and the same
-- cross-entity audit_log the manual audit_ticket_change() trigger writes to
-- — so this never depends solely on the two new columns above to be legible.
CREATE OR REPLACE FUNCTION public.audit_ticket_auto_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- internal=false matches how MatterOwnershipPanel.tsx logs manual
  -- assignment/reassignment (kind='assignment') today — same visibility.
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal)
  VALUES (
    NEW.id,
    NULL,
    'assignment',
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'auto_assigned' ELSE 'auto_assign_skipped' END,
    CASE
      WHEN NEW.assigned_to IS NOT NULL THEN 'Automatically assigned: ' || NEW.assignment_note
      ELSE COALESCE(NEW.assignment_note, 'Not auto-assigned.')
    END,
    false
  );

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, after_value)
  VALUES (
    NULL,
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'ticket_auto_assigned' ELSE 'ticket_auto_assign_skipped' END,
    'ticket',
    NEW.id,
    NEW.title,
    NEW.assignment_note,
    jsonb_build_object(
      'assigned_to', NEW.assigned_to,
      'current_action_owner', NEW.current_action_owner,
      'assignment_source', NEW.assignment_source,
      'functional_role_code', NEW.functional_role_code
    )
  );
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS tickets_audit_auto_assign ON public.tickets;
CREATE TRIGGER tickets_audit_auto_assign
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_ticket_auto_assign();
