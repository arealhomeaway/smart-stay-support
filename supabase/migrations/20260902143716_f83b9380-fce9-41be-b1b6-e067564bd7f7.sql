CREATE TABLE public.staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  entity_type text,
  entity_id uuid,
  link_path text,
  priority text NOT NULL DEFAULT 'normal',
  actor_id uuid,
  read_at timestamptz,
  email_status text NOT NULL DEFAULT 'none',
  email_attempts integer NOT NULL DEFAULT 0,
  email_error text,
  delivered_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_notifications_email_status_check
    CHECK (email_status IN ('none','pending','sent','skipped','failed'))
);

CREATE INDEX staff_notifications_user_unread_idx
  ON public.staff_notifications (user_id, read_at, created_at DESC);
CREATE INDEX staff_notifications_email_pending_idx
  ON public.staff_notifications (email_status, created_at)
  WHERE email_status = 'pending';

GRANT SELECT, UPDATE ON public.staff_notifications TO authenticated;
GRANT ALL ON public.staff_notifications TO service_role;

ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients read their own notifications"
  ON public.staff_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Recipients mark their own notifications read"
  ON public.staff_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Central writer. Security definer so triggers can insert regardless of the
-- acting user's privileges. Never notifies someone about their own action.
CREATE OR REPLACE FUNCTION public.notify_staff(
  _user_id uuid,
  _kind text,
  _title text,
  _body text,
  _entity_type text,
  _entity_id uuid,
  _link_path text,
  _priority text,
  _actor_id uuid,
  _email boolean,
  _is_demo boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.staff_notifications (
    user_id, kind, title, body, entity_type, entity_id, link_path,
    priority, actor_id, email_status, is_demo
  ) VALUES (
    _user_id, _kind, _title, coalesce(_body, ''), _entity_type, _entity_id, _link_path,
    coalesce(_priority, 'normal'), _actor_id,
    CASE WHEN _email AND NOT coalesce(_is_demo, false) THEN 'pending' ELSE 'none' END,
    coalesce(_is_demo, false)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_staff(uuid,text,text,text,text,uuid,text,text,uuid,boolean,boolean) FROM PUBLIC, anon, authenticated;

-- Ticket assignment, reassignment and reopen
CREATE OR REPLACE FUNCTION public.notify_ticket_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link text := '/tickets/' || NEW.id::text;
  _ref text := coalesce('#' || NEW.ref::text || ' ', '');
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM public.notify_staff(
      NEW.assigned_to,
      'ticket_assigned',
      _ref || NEW.title,
      'This ticket is now yours. Open it to see the next action.',
      'ticket', NEW.id, _link,
      CASE WHEN NEW.priority = 'p1' THEN 'urgent' ELSE 'normal' END,
      auth.uid(), true, NEW.is_demo
    );
  END IF;

  IF TG_OP = 'UPDATE'
     AND coalesce(NEW.reopen_count, 0) > coalesce(OLD.reopen_count, 0) THEN
    PERFORM public.notify_staff(
      NEW.assigned_to,
      'ticket_reopened',
      'Reopened: ' || _ref || NEW.title,
      'This ticket was reopened and needs another pass.',
      'ticket', NEW.id, _link, 'urgent', auth.uid(), true, NEW.is_demo
    );
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      PERFORM public.notify_staff(
        OLD.assigned_to,
        'ticket_reopened',
        'Reopened: ' || _ref || NEW.title,
        'A ticket you previously owned was reopened.',
        'ticket', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_ticket_events_trg
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_events();

-- Handoffs: recipient on request, sender on the decision
CREATE OR REPLACE FUNCTION public.notify_handoff_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link text := CASE WHEN NEW.ticket_id IS NOT NULL THEN '/tickets/' || NEW.ticket_id::text ELSE NULL END;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM public.notify_staff(
      NEW.to_user,
      'handoff_pending',
      'Handoff waiting for you to accept',
      coalesce(NEW.next_action, NEW.summary, 'Open the ticket and accept or decline the handoff.'),
      'handoff', NEW.id, _link,
      CASE WHEN NEW.priority = 'p1' THEN 'urgent' ELSE 'normal' END,
      NEW.from_user, true, NEW.is_demo
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('accepted', 'rejected') THEN
    PERFORM public.notify_staff(
      NEW.from_user,
      'handoff_' || NEW.status,
      CASE WHEN NEW.status = 'accepted'
        THEN 'Your handoff was accepted'
        ELSE 'Your handoff was declined' END,
      CASE WHEN NEW.status = 'accepted'
        THEN 'Ownership has transferred.'
        ELSE coalesce(NEW.response_reason, 'It came back to you.') END,
      'handoff', NEW.id, _link,
      CASE WHEN NEW.status = 'rejected' THEN 'urgent' ELSE 'normal' END,
      NEW.to_user, false, NEW.is_demo
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_handoff_events_trg
AFTER INSERT OR UPDATE ON public.handoffs
FOR EACH ROW EXECUTE FUNCTION public.notify_handoff_events();

-- Approvals: the named approver learns there is work waiting
CREATE OR REPLACE FUNCTION public.notify_approval_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approver_id IS NOT NULL
     AND NEW.status = 'pending'
     AND (TG_OP = 'INSERT'
          OR NEW.approver_id IS DISTINCT FROM OLD.approver_id
          OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_staff(
      NEW.approver_id,
      'approval_required',
      'Approval needed: ' || NEW.title,
      coalesce(NEW.detail, 'Open Resolve to approve or decline.'),
      'approval', NEW.id, '/oversight', 'urgent',
      NEW.requested_by, true, NEW.is_demo
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_approval_events_trg
AFTER INSERT OR UPDATE ON public.approvals
FOR EACH ROW EXECUTE FUNCTION public.notify_approval_events();