-- Scorecard capture, part 2: locked receipt time, server time on history, next action and
-- waiting recorded as their own lines. Additive only. No BEGIN/COMMIT.

-- ---------------------------------------------------------------------------
-- The first received time is set once by the server and never changes.
-- ---------------------------------------------------------------------------
-- Not SECURITY DEFINER on purpose: current_user tells a signed-in screen (always server time)
-- apart from a trusted server function, such as the Notion import keeping the original date.
CREATE OR REPLACE FUNCTION private.lock_ticket_receipt_time()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reported_at IS NULL OR current_user IN ('authenticated', 'anon') THEN
      NEW.reported_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.reported_at IS NOT NULL AND NEW.reported_at IS DISTINCT FROM OLD.reported_at THEN
    RAISE EXCEPTION 'The time this ticket was first received cannot be changed.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tickets_lock_receipt_time
  BEFORE INSERT OR UPDATE OF reported_at ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.lock_ticket_receipt_time();

-- ---------------------------------------------------------------------------
-- Every history line gets the server time.
-- ---------------------------------------------------------------------------
-- Only imported Notion comments and demo seeding keep their own dates, and only when written
-- by a trusted server function, never by a signed-in screen.
CREATE OR REPLACE FUNCTION private.stamp_ticket_activity_time()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     OR NOT (NEW.event_type = 'imported_comment' OR coalesce(NEW.is_demo, false)) THEN
    NEW.created_at := now();
    NEW.event_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ticket_activity_server_time
  BEFORE INSERT ON public.ticket_activity
  FOR EACH ROW EXECUTE FUNCTION private.stamp_ticket_activity_time();

-- ---------------------------------------------------------------------------
-- Next action and Waiting, each change recorded with who and when.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ticket_state_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  field text NOT NULL CHECK (field IN ('next_action', 'waiting')),
  change text NOT NULL CHECK (change IN ('set', 'changed', 'completed', 'started', 'updated', 'ended')),
  next_action text,
  next_action_due_at timestamptz,
  waiting_on text,
  waiting_reason text,
  next_review_at timestamptz,
  actor_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  is_imported boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE public.ticket_state_log IS
  'Add-only history of next action and Waiting changes on tickets. Written by trigger only.';
CREATE INDEX ticket_state_log_ticket ON public.ticket_state_log (ticket_id, recorded_at);

GRANT SELECT ON public.ticket_state_log TO authenticated;
GRANT SELECT, INSERT ON public.ticket_state_log TO service_role;
ALTER TABLE public.ticket_state_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticket_state_log_read ON public.ticket_state_log
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION private.stamp_state_log_time()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.recorded_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER ticket_state_log_stamp BEFORE INSERT ON public.ticket_state_log
  FOR EACH ROW EXECUTE FUNCTION private.stamp_state_log_time();
-- private.refuse_record_change() comes from 01_scorecard_records.sql.
CREATE TRIGGER ticket_state_log_no_change BEFORE UPDATE OR DELETE ON public.ticket_state_log
  FOR EACH ROW EXECUTE FUNCTION private.refuse_record_change();
CREATE TRIGGER ticket_state_log_no_truncate BEFORE TRUNCATE ON public.ticket_state_log
  FOR EACH STATEMENT EXECUTE FUNCTION private.refuse_record_change();

CREATE OR REPLACE FUNCTION private.log_ticket_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _old_na text := CASE WHEN TG_OP = 'UPDATE' THEN nullif(btrim(coalesce(OLD.next_action, '')), '') END;
  _new_na text := nullif(btrim(coalesce(NEW.next_action, '')), '');
  _old_due timestamptz := CASE WHEN TG_OP = 'UPDATE' THEN OLD.next_action_due_at END;
  _old_wait boolean := TG_OP = 'UPDATE' AND OLD.status = 'waiting';
  _new_wait boolean := NEW.status = 'waiting';
  _closing boolean := TG_OP = 'UPDATE' AND OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL;
  _change text;
  _imported boolean := coalesce(NEW.external_source = 'notion', false);
BEGIN
  _change := CASE
    WHEN _old_na IS NULL AND _new_na IS NOT NULL THEN 'set'
    WHEN _old_na IS NOT NULL AND _new_na IS NULL THEN 'completed'
    WHEN _new_na IS NOT NULL AND _closing THEN 'completed'
    WHEN _old_na IS NOT NULL AND (_new_na IS DISTINCT FROM _old_na OR NEW.next_action_due_at IS DISTINCT FROM _old_due) THEN 'changed'
  END;
  IF _change IS NOT NULL THEN
    INSERT INTO public.ticket_state_log (ticket_id, field, change, next_action, next_action_due_at, actor_id, is_imported, is_demo)
    VALUES (NEW.id, 'next_action', _change, coalesce(_new_na, _old_na),
            CASE WHEN _change = 'completed' THEN coalesce(NEW.next_action_due_at, _old_due) ELSE NEW.next_action_due_at END,
            auth.uid(), _imported, coalesce(NEW.is_demo, false));
  END IF;

  _change := CASE
    WHEN NOT _old_wait AND _new_wait THEN 'started'
    WHEN _old_wait AND NOT _new_wait THEN 'ended'
    WHEN _old_wait AND _new_wait AND (
      NEW.waiting_on IS DISTINCT FROM OLD.waiting_on OR NEW.waiting_reason IS DISTINCT FROM OLD.waiting_reason
      OR NEW.next_review_at IS DISTINCT FROM OLD.next_review_at) THEN 'updated'
  END;
  IF _change IS NOT NULL THEN
    INSERT INTO public.ticket_state_log (ticket_id, field, change, waiting_on, waiting_reason, next_review_at, actor_id, is_imported, is_demo)
    VALUES (NEW.id, 'waiting', _change,
            CASE WHEN _change = 'ended' THEN OLD.waiting_on ELSE NEW.waiting_on END,
            CASE WHEN _change = 'ended' THEN OLD.waiting_reason ELSE NEW.waiting_reason END,
            CASE WHEN _change = 'ended' THEN OLD.next_review_at ELSE NEW.next_review_at END,
            auth.uid(), _imported, coalesce(NEW.is_demo, false));
  END IF;
  RETURN NULL;
END $$;

-- Imports run quietly and are not logged here; their history is the imported record itself.
CREATE TRIGGER tickets_log_state
  AFTER INSERT OR UPDATE OF next_action, next_action_due_at, status, waiting_on, waiting_reason, next_review_at, resolved_at
  ON public.tickets
  FOR EACH ROW WHEN (current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on')
  EXECUTE FUNCTION private.log_ticket_state();
