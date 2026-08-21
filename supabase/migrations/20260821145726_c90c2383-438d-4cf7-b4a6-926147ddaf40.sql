CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  role app_role NOT NULL,
  invitee_email text,
  invitee_name text,
  note text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read team invites" ON public.team_invites
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create team invites" ON public.team_invites
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update team invites" ON public.team_invites
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX team_invites_code_idx ON public.team_invites (code);