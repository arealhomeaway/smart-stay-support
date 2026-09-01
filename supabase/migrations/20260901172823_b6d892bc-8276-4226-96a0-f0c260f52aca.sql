-- internal-staff / credential-manager helpers
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager','tech','onboarding')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_credentials(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager','onboarding')
  )
$$;

CREATE TYPE public.credential_category AS ENUM (
  'wifi','gate_community','property_access','garage','lockbox',
  'streaming','supply_storage','alarm_security','other'
);

CREATE TABLE public.property_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category public.credential_category NOT NULL DEFAULT 'other',
  label text NOT NULL,
  username text,
  secret_ciphertext text,
  secret_nonce text,
  instructions text,
  last_verified_on date,
  verified_by uuid,
  source text NOT NULL DEFAULT 'staff_entry',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_credentials_property_idx ON public.property_credentials(property_id) WHERE active;

-- non-secret columns only for authenticated; ciphertext stays service_role-only
GRANT SELECT (id, property_id, category, label, username, instructions,
              last_verified_on, verified_by, source, sort_order, active,
              created_by, created_at, updated_at)
  ON public.property_credentials TO authenticated;
GRANT ALL ON public.property_credentials TO service_role;

ALTER TABLE public.property_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff read credential entries"
  ON public.property_credentials FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE TABLE public.credential_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid REFERENCES public.property_credentials(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('reveal','copy')),
  ticket_id uuid,
  user_agent_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credential_access_log_cred_idx ON public.credential_access_log(credential_id, occurred_at DESC);

GRANT SELECT ON public.credential_access_log TO authenticated;
GRANT ALL ON public.credential_access_log TO service_role;

ALTER TABLE public.credential_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Credential managers read access log"
  ON public.credential_access_log FOR SELECT TO authenticated
  USING (public.can_manage_credentials(auth.uid()));

CREATE TABLE public.credential_intake_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source_field text NOT NULL,
  suggested_category public.credential_category NOT NULL DEFAULT 'other',
  suggested_label text,
  secret_ciphertext text NOT NULL,
  secret_nonce text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credential_intake_pending_idx ON public.credential_intake_queue(property_id) WHERE status = 'pending';

GRANT SELECT (id, property_id, source_field, suggested_category, suggested_label,
              status, reviewed_by, reviewed_at, created_at, updated_at)
  ON public.credential_intake_queue TO authenticated;
GRANT ALL ON public.credential_intake_queue TO service_role;

ALTER TABLE public.credential_intake_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Credential managers read intake queue"
  ON public.credential_intake_queue FOR SELECT TO authenticated
  USING (public.can_manage_credentials(auth.uid()));

CREATE TRIGGER update_property_credentials_updated_at
  BEFORE UPDATE ON public.property_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credential_intake_queue_updated_at
  BEFORE UPDATE ON public.credential_intake_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();