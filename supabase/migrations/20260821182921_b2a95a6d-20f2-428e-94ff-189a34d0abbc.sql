CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  purpose text NOT NULL DEFAULT 'general',
  sender text,
  reply_to text,
  ticket_id uuid,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_log_created_at_idx ON public.email_log (created_at DESC);
CREATE INDEX email_log_status_idx ON public.email_log (status);

GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors can read the email log"
ON public.email_log FOR SELECT TO authenticated
USING (public.is_supervisor(auth.uid()));