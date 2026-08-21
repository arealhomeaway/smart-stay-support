ALTER TABLE public.owner_programs
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms_p1 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true;

ALTER TABLE public.owner_time_entries
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE TABLE public.owner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  owner_user_id uuid,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.owner_reviews(id) ON DELETE CASCADE,
  kind text NOT NULL,
  priority text NOT NULL DEFAULT 'p3',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  action_path text,
  read_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending',
  sms_status text NOT NULL DEFAULT 'skipped',
  delivery_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX owner_notifications_program_idx ON public.owner_notifications (program_id, created_at DESC);
CREATE INDEX owner_notifications_pending_idx ON public.owner_notifications (created_at) WHERE email_status = 'pending' OR sms_status = 'pending';

GRANT SELECT, UPDATE ON public.owner_notifications TO authenticated;
GRANT ALL ON public.owner_notifications TO service_role;
ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their own alerts" ON public.owner_notifications
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.owns_program(auth.uid(), program_id) OR public.is_staff(auth.uid()));

CREATE POLICY "Owners mark their own alerts read" ON public.owner_notifications
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.owns_program(auth.uid(), program_id))
  WITH CHECK (owner_user_id = auth.uid() OR public.owns_program(auth.uid(), program_id));

CREATE OR REPLACE FUNCTION public.owner_sees_property(_user_id uuid, _property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.owner_programs
    WHERE property_id = _property_id AND owner_user_id = _user_id
  )
$$;

CREATE POLICY "Owners read tickets at their home" ON public.tickets
  FOR SELECT TO authenticated
  USING (property_id IS NOT NULL AND public.owner_sees_property(auth.uid(), property_id));

CREATE POLICY "Owners read properties in their program" ON public.properties
  FOR SELECT TO authenticated
  USING (public.owner_sees_property(auth.uid(), id));

CREATE OR REPLACE FUNCTION public.notify_owner_of_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prog record;
  is_p1 boolean;
  k text;
  t text;
  b text;
BEGIN
  IF NEW.property_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO prog FROM public.owner_programs
   WHERE property_id = NEW.property_id AND status IN ('pending','active')
   LIMIT 1;
  IF prog.id IS NULL THEN RETURN NEW; END IF;

  is_p1 := lower(coalesce(NEW.priority,'')) = 'p1';

  IF TG_OP = 'INSERT' THEN
    k := CASE WHEN is_p1 THEN 'ticket_p1' ELSE 'ticket_opened' END;
    t := CASE WHEN is_p1 THEN 'Urgent at your home: ' ELSE 'New at your home: ' END || NEW.title;
    b := coalesce(NEW.description, 'A new matter was opened at your home.');
  ELSIF NEW.status IN ('resolved','closed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    k := 'ticket_resolved';
    t := 'Resolved: ' || NEW.title;
    b := coalesce(NEW.resolution_notes, 'This matter is now closed.');
  ELSIF is_p1 AND lower(coalesce(OLD.priority,'')) <> 'p1' THEN
    k := 'ticket_p1';
    t := 'Urgent at your home: ' || NEW.title;
    b := coalesce(NEW.description, 'This matter was raised to urgent.');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.owner_notifications
    (program_id, owner_user_id, ticket_id, kind, priority, title, body, action_path, email_status, sms_status)
  VALUES (
    prog.id, prog.owner_user_id, NEW.id, k, lower(coalesce(NEW.priority,'p3')), t, left(b, 800), '/owner',
    CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,
    CASE WHEN is_p1 AND prog.notify_sms_p1 THEN 'pending' ELSE 'skipped' END
  );

  RETURN NEW;
END; $$;

CREATE TRIGGER tickets_notify_owner
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_of_ticket();

CREATE OR REPLACE FUNCTION public.notify_owner_of_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prog record;
BEGIN
  IF NEW.status <> 'awaiting_owner' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'awaiting_owner' THEN RETURN NEW; END IF;

  SELECT * INTO prog FROM public.owner_programs WHERE id = NEW.program_id;
  IF prog.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.owner_notifications
    (program_id, owner_user_id, review_id, ticket_id, kind, priority, title, body, action_path, email_status, sms_status)
  VALUES (
    prog.id, prog.owner_user_id, NEW.id, NEW.ticket_id, 'review_ready', 'p3',
    'Ready for you: ' || NEW.title,
    left(coalesce(NEW.recommendation, NEW.impact, 'This review is ready for your decision.'), 800),
    '/owner',
    CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,
    'skipped'
  );

  RETURN NEW;
END; $$;

CREATE TRIGGER owner_reviews_notify_owner
AFTER INSERT OR UPDATE ON public.owner_reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_of_review();