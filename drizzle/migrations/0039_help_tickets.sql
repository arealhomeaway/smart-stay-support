CREATE TABLE public.help_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid NOT NULL DEFAULT auth.uid(),
  submitter_name text,
  submitter_email text,
  user_role text,
  portal text,
  property_id uuid,
  property_label text,
  page_title text,
  route text,
  kind text NOT NULL CHECK (kind IN ('issue','suggestion')),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 5000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_item_id text,
  user_agent text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','planned','resolved','closed')),
  email_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.help_tickets TO authenticated;
GRANT ALL ON public.help_tickets TO service_role;
ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users submit own help tickets" ON public.help_tickets FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'new');
CREATE POLICY "Leadership reads help tickets" ON public.help_tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid()) OR submitted_by = auth.uid());
CREATE POLICY "Leadership updates help tickets" ON public.help_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid()));

INSERT INTO public.app_settings(key, value) VALUES ('help_feedback_recipient', '{"email":"info@arealhomeaway.com"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "Users upload own help files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'help-feedback' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Leadership reads help files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'help-feedback' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid())));