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

CREATE TRIGGER ticket_state_log_stamp BEFORE INSERT ON public.ticket_state_log
  FOR EACH ROW EXECUTE FUNCTION private.stamp_state_log_time();
