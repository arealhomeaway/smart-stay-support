CREATE TABLE public.coach_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  guidance JSONB NOT NULL DEFAULT '{}'::jsonb,
  follow_ups JSONB NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_sessions TO authenticated;
GRANT ALL ON public.coach_sessions TO service_role;

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read coach sessions" ON public.coach_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can create coach sessions" ON public.coach_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team can update coach sessions" ON public.coach_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX coach_sessions_created_at_idx ON public.coach_sessions (created_at DESC);
CREATE INDEX coach_sessions_ticket_idx ON public.coach_sessions (ticket_id);