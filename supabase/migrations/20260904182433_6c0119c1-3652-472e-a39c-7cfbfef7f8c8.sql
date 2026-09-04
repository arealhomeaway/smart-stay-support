-- Human-readable reference for every approval, so an owner's email reply can name it.
CREATE SEQUENCE IF NOT EXISTS public.approvals_ref_seq;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS ref bigint;
UPDATE public.approvals SET ref = nextval('public.approvals_ref_seq') WHERE ref IS NULL;
ALTER TABLE public.approvals ALTER COLUMN ref SET DEFAULT nextval('public.approvals_ref_seq');
CREATE UNIQUE INDEX IF NOT EXISTS approvals_ref_key ON public.approvals(ref);

-- Identity of the outbound owner email, so a reply on the same thread can be matched.
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS owner_email_to text;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS owner_email_sent_at timestamptz;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS owner_email_conversation_id text;

-- Homeowner replies captured from the shared inbox.
CREATE TABLE IF NOT EXISTS public.approval_email_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES public.approvals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'matched',
  match_method text,
  message_id text,
  internet_message_id text NOT NULL,
  conversation_id text,
  subject text,
  from_name text,
  from_address text,
  received_at timestamptz,
  body_text text,
  web_link text,
  has_attachments boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_by uuid,
  linked_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS approval_email_responses_msg_key
  ON public.approval_email_responses(internet_message_id);
CREATE INDEX IF NOT EXISTS approval_email_responses_approval_idx
  ON public.approval_email_responses(approval_id);
CREATE INDEX IF NOT EXISTS approval_email_responses_status_idx
  ON public.approval_email_responses(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_email_responses TO authenticated;
GRANT ALL ON public.approval_email_responses TO service_role;
ALTER TABLE public.approval_email_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read homeowner replies"
  ON public.approval_email_responses FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff can link homeowner replies"
  ON public.approval_email_responses FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));