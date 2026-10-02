ALTER TABLE public.tickets ADD COLUMN linked_feedback_id uuid REFERENCES public.guest_feedback(id) ON DELETE SET NULL;
CREATE INDEX tickets_linked_feedback_idx ON public.tickets (linked_feedback_id) WHERE linked_feedback_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.log_feedback_linked_work() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.linked_feedback_id IS NOT NULL THEN
    INSERT INTO guest_feedback_events (feedback_id, kind, detail, actor_id)
    VALUES (NEW.linked_feedback_id, 'operational_follow_up_created', '#' || NEW.ref || ' ' || NEW.title, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_feedback_linked_work AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.log_feedback_linked_work();
