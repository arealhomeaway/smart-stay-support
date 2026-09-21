CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  audience text NOT NULL DEFAULT 'guest',
  contexts text[] NOT NULL DEFAULT ARRAY['ticket']::text[],
  subject text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_audience_chk CHECK (audience = ANY (ARRAY['guest'::text,'owner'::text,'vendor'::text,'staff'::text]))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read message templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Supervisors can create message templates"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "Supervisors can change message templates"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "Supervisors can remove message templates"
  ON public.email_templates FOR DELETE TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_email_template()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER email_templates_touch
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_template();

ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS sent_by uuid;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_log_entity_idx ON public.email_log (entity_type, entity_id, created_at DESC);

GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;

CREATE POLICY "Staff can read message history"
  ON public.email_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));