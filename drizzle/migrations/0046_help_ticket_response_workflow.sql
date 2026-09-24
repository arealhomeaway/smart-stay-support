ALTER TABLE public.help_tickets DROP CONSTRAINT help_tickets_status_check;
ALTER TABLE public.help_tickets ADD CONSTRAINT help_tickets_status_check CHECK (status = ANY (ARRAY['new','reviewing','planned','in_progress','resolved','closed']));
ALTER TABLE public.help_tickets ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

CREATE TABLE public.help_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.help_tickets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('status','reply','note')),
  from_status text,
  to_status text,
  body text CHECK (body IS NULL OR length(body) <= 5000),
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  email_status text,
  email_recipient text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX help_ticket_events_ticket_idx ON public.help_ticket_events(ticket_id, created_at);
GRANT SELECT, INSERT ON public.help_ticket_events TO authenticated;
GRANT ALL ON public.help_ticket_events TO service_role;
ALTER TABLE public.help_ticket_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads help ticket events" ON public.help_ticket_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid()));
CREATE POLICY "Leadership writes help ticket events" ON public.help_ticket_events FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid())));