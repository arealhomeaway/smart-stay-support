-- 1. Assignment-based onboarding lead ------------------------------------
CREATE OR REPLACE FUNCTION private.is_onboarding_lead(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    JOIN public.user_roles ur ON ur.user_id = _user_id AND ur.role::text = 'onboarding'
    WHERE p.id = _property_id
      AND p.onboarding_owner = _user_id
  )
$$;

REVOKE ALL ON FUNCTION private.is_onboarding_lead(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.is_onboarding_lead(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Supervisors review handoffs" ON public.property_handoffs;
CREATE POLICY "Supervisors review handoffs"
  ON public.property_handoffs FOR UPDATE
  TO authenticated
  USING (
    private.is_supervisor(auth.uid())
    OR (gate_step = 'kati_review' AND private.is_onboarding_lead(auth.uid(), property_id))
  )
  WITH CHECK (
    private.is_supervisor(auth.uid())
    OR (gate_step IN ('kati_review', 'micah_review') AND private.is_onboarding_lead(auth.uid(), property_id))
  );

-- 2. Homeowner approval decisions -----------------------------------------
CREATE POLICY "Owners read their own approvals"
  ON public.approvals FOR SELECT
  TO authenticated
  USING (
    property_id IS NOT NULL
    AND private.owner_sees_property(auth.uid(), property_id)
  );

CREATE POLICY "Owners decide their own pending approvals"
  ON public.approvals FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND approver_id = auth.uid()
    AND property_id IS NOT NULL
    AND private.owner_sees_property(auth.uid(), property_id)
  )
  WITH CHECK (
    approver_id = auth.uid()
    AND property_id IS NOT NULL
    AND private.owner_sees_property(auth.uid(), property_id)
  );

-- 3. Scheduling anchors (mechanism only) ----------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS planned_closing_on date,
  ADD COLUMN IF NOT EXISTS actual_closing_on date,
  ADD COLUMN IF NOT EXISTS actual_access_on date;

ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS schedule_anchor text,
  ADD COLUMN IF NOT EXISTS schedule_offset_days integer,
  ADD COLUMN IF NOT EXISTS due_on_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_on_source text;

ALTER TABLE public.onboarding_tasks
  DROP CONSTRAINT IF EXISTS onboarding_tasks_schedule_anchor_check;
ALTER TABLE public.onboarding_tasks
  ADD CONSTRAINT onboarding_tasks_schedule_anchor_check
  CHECK (schedule_anchor IS NULL OR schedule_anchor IN ('planned_closing', 'actual_closing', 'actual_access'));