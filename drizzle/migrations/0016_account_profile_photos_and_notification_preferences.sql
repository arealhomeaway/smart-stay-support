-- Personal account settings: a profile photo people recognise on work, and
-- per-person control over which notifications reach their inbox.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_assignments boolean NOT NULL DEFAULT true,
  email_approvals boolean NOT NULL DEFAULT true,
  email_escalations boolean NOT NULL DEFAULT true,
  email_handoffs boolean NOT NULL DEFAULT true,
  email_work_orders boolean NOT NULL DEFAULT true,
  inapp_assignments boolean NOT NULL DEFAULT true,
  inapp_approvals boolean NOT NULL DEFAULT true,
  inapp_escalations boolean NOT NULL DEFAULT true,
  inapp_handoffs boolean NOT NULL DEFAULT true,
  inapp_work_orders boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;
GRANT ALL ON public.user_notification_preferences TO service_role;

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "People read their own notification preferences"
  ON public.user_notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "People set their own notification preferences"
  ON public.user_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "People change their own notification preferences"
  ON public.user_notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
