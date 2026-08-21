-- 1. New permission role for onboarding staff
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'onboarding';

-- 2. Role helper functions (text comparison so this migration stays transaction-safe)
CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','manager'))
$$;

CREATE OR REPLACE FUNCTION public.is_onboarding_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','manager','onboarding'))
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin','manager','tech','onboarding')
  )
$$;

-- 3. Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  actor_label text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

-- 4. Property lifecycle on the existing property record (no duplicate property store)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active_operations',
  ADD COLUMN IF NOT EXISTS onboarding_stage text,
  ADD COLUMN IF NOT EXISTS onboarding_owner uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS handoff_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- 5. Onboarding tasks (pre-handoff work, deliberately not operational matters)
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'setup',
  title text NOT NULL,
  detail text,
  assigned_to uuid REFERENCES auth.users(id),
  due_on date,
  blocker text,
  requires_owner_approval boolean NOT NULL DEFAULT false,
  owner_approval_status text NOT NULL DEFAULT 'not_required',
  evidence_note text,
  evidence_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  blocks_handoff boolean NOT NULL DEFAULT true,
  carryover_of uuid REFERENCES public.onboarding_tasks(id),
  carryover_reason text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read onboarding tasks" ON public.onboarding_tasks
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid()) OR public.owner_sees_property(auth.uid(), property_id)
  );
CREATE POLICY "Onboarding staff create tasks" ON public.onboarding_tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Onboarding staff update tasks" ON public.onboarding_tasks
  FOR UPDATE TO authenticated USING (public.is_onboarding_staff(auth.uid()))
  WITH CHECK (public.is_onboarding_staff(auth.uid()));
CREATE TRIGGER onboarding_tasks_updated BEFORE UPDATE ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Controlled handoff from onboarding to operations
CREATE TABLE IF NOT EXISTS public.property_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested',
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  open_task_ids uuid[] NOT NULL DEFAULT '{}',
  carryover_accepted boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  corrections text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.property_handoffs TO authenticated;
GRANT ALL ON public.property_handoffs TO service_role;
ALTER TABLE public.property_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read handoffs" ON public.property_handoffs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Onboarding staff request handoffs" ON public.property_handoffs
  FOR INSERT TO authenticated WITH CHECK (public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Supervisors review handoffs" ON public.property_handoffs
  FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));
CREATE TRIGGER property_handoffs_updated BEFORE UPDATE ON public.property_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS property_handoffs_property_idx ON public.property_handoffs(property_id);
CREATE INDEX IF NOT EXISTS onboarding_tasks_property_idx ON public.onboarding_tasks(property_id);

-- 7. Audit role changes automatically
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, after_value, before_value)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'role_granted' ELSE 'role_revoked' END,
    'user_role',
    COALESCE(NEW.user_id, OLD.user_id),
    CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS user_roles_audit ON public.user_roles;
CREATE TRIGGER user_roles_audit AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();
