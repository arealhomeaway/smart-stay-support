ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;
COMMENT ON COLUMN public.expenses.archived_at IS 'Set only by archive_expense (audited). Archived expenses leave active queues and totals; history is kept.';

CREATE OR REPLACE FUNCTION private.guard_expense_extra() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE
  me uuid := auth.uid();
  archiving boolean := coalesce(current_setting('resolve.expense_archive', true), '') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.archive_reason IS NOT NULL THEN
      RAISE EXCEPTION 'An expense cannot be created archived';
    END IF;
    IF me IS NOT NULL AND NOT (
      (coalesce(trim(NEW.payee),'') <> '' OR NEW.property_id IS NOT NULL)
      AND (NEW.amount IS NOT NULL OR coalesce(trim(NEW.reason),'') <> '')
    ) THEN
      RAISE EXCEPTION 'Enter a payee or a home, and an amount or a reason, before saving an expense';
    END IF;
  ELSE
    IF NOT archiving THEN
      IF OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This expense is archived and cannot be changed'; END IF;
      IF NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.archived_by IS DISTINCT FROM OLD.archived_by OR NEW.archive_reason IS DISTINCT FROM OLD.archive_reason THEN
        RAISE EXCEPTION 'Use the Archive action to archive an expense';
      END IF;
    END IF;
    IF NEW.finance_review = 'reviewed' AND OLD.finance_review IS DISTINCT FROM 'reviewed'
       AND NEW.reservation_link_state = 'linked' AND coalesce(trim(NEW.ownerrez_booking_id),'') = '' THEN
      RAISE EXCEPTION 'Enter the linked OwnerRez reservation before Finance review';
    END IF;
  END IF;
  IF NEW.leadership_assignee IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.leadership_assignee IS DISTINCT FROM OLD.leadership_assignee)
     AND NOT private.is_director(NEW.leadership_assignee) THEN
    RAISE EXCEPTION 'A leadership decision can only be routed to leadership who can record it';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS expenses_guard_extra ON public.expenses;
CREATE TRIGGER expenses_guard_extra BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.guard_expense_extra();

CREATE OR REPLACE FUNCTION private.guard_expense_link_archived() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.expense_id ELSE NEW.expense_id END AND e.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This expense is archived and cannot be changed';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS expense_links_archived_guard ON public.expense_links;
CREATE TRIGGER expense_links_archived_guard BEFORE INSERT OR DELETE ON public.expense_links
  FOR EACH ROW EXECUTE FUNCTION private.guard_expense_link_archived();

CREATE OR REPLACE FUNCTION public.archive_expense(_expense uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE
  me uuid := auth.uid();
  e public.expenses;
BEGIN
  IF me IS NULL OR NOT public.is_internal_staff(me) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required to archive an expense'; END IF;
  SELECT * INTO e FROM public.expenses WHERE id = _expense FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF e.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Already archived'; END IF;
  IF NOT (private.is_finance_lead(me) OR private.is_director(me)
          OR (e.created_by = me AND e.finance_review IN ('not_started','in_review'))) THEN
    RAISE EXCEPTION 'Only the Finance lead, leadership, or the person who entered an unreviewed expense can archive it';
  END IF;
  IF e.finance_review = 'reviewed' AND NOT (private.is_finance_lead(me) OR public.has_role(me,'admin')) THEN
    RAISE EXCEPTION 'Only the Finance lead or an administrator can archive a reviewed expense';
  END IF;
  PERFORM set_config('resolve.expense_archive', 'on', true);
  UPDATE public.expenses SET archived_at = now(), archived_by = me, archive_reason = trim(_reason) WHERE id = _expense;
  PERFORM set_config('resolve.expense_archive', '', true);
  INSERT INTO public.expense_events(expense_id, actor_id, kind, after_value, reason)
  VALUES (_expense, me, 'archived', jsonb_build_object('archived', true), trim(_reason));
END $$;
REVOKE ALL ON FUNCTION public.archive_expense(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.archive_expense(uuid, text) TO authenticated;