-- Vendor assignment on a matter
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS vendor_user_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS tickets_vendor_user_id_idx ON public.tickets (vendor_user_id);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS vendor_brief text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS vendor_dispatched_at timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS vendor_accepted_at timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS vendor_completed_at timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS vendor_status text NOT NULL DEFAULT 'none';

-- Internal staff = anyone who is not an outside vendor
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager','tech')
  )
$$;

-- Is this user the vendor assigned to this matter?
CREATE OR REPLACE FUNCTION public.is_assigned_vendor(_user_id uuid, _ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = _ticket_id AND vendor_user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_assigned_vendor(uuid, uuid) FROM anon;

-- TICKETS: staff see everything; vendors only their own dispatched jobs
DROP POLICY IF EXISTS tickets_select ON public.tickets;
CREATE POLICY tickets_select ON public.tickets FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR vendor_user_id = auth.uid());

DROP POLICY IF EXISTS tickets_insert ON public.tickets;
CREATE POLICY tickets_insert ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS tickets_update ON public.tickets;
CREATE POLICY tickets_update ON public.tickets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR vendor_user_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) OR vendor_user_id = auth.uid());

-- TICKET STEPS: vendors work the checklist on their own jobs only
DROP POLICY IF EXISTS ticket_steps_all ON public.ticket_steps;
CREATE POLICY ticket_steps_staff ON public.ticket_steps FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY ticket_steps_vendor_select ON public.ticket_steps FOR SELECT TO authenticated
  USING (public.is_assigned_vendor(auth.uid(), ticket_id));
CREATE POLICY ticket_steps_vendor_update ON public.ticket_steps FOR UPDATE TO authenticated
  USING (public.is_assigned_vendor(auth.uid(), ticket_id))
  WITH CHECK (public.is_assigned_vendor(auth.uid(), ticket_id));

-- TICKET ACTIVITY: vendors read and post only on their own jobs
DROP POLICY IF EXISTS ticket_activity_select ON public.ticket_activity;
CREATE POLICY ticket_activity_select ON public.ticket_activity FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_assigned_vendor(auth.uid(), ticket_id));

DROP POLICY IF EXISTS ticket_activity_insert ON public.ticket_activity;
CREATE POLICY ticket_activity_insert ON public.ticket_activity FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (public.is_staff(auth.uid()) OR public.is_assigned_vendor(auth.uid(), ticket_id))
  );

-- PROPERTIES: vendors only see homes where they have a job
DROP POLICY IF EXISTS properties_select ON public.properties;
CREATE POLICY properties_select ON public.properties FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.property_id = properties.id AND t.vendor_user_id = auth.uid())
  );

DROP POLICY IF EXISTS properties_insert ON public.properties;
CREATE POLICY properties_insert ON public.properties FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS properties_update ON public.properties;
CREATE POLICY properties_update ON public.properties FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- PROFILES: vendors only see their own record
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR id = auth.uid());

-- Internal-only tables stay staff-only
DROP POLICY IF EXISTS handoffs_select ON public.handoffs;
CREATE POLICY handoffs_select ON public.handoffs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS handoffs_update ON public.handoffs;
CREATE POLICY handoffs_update ON public.handoffs FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS handoffs_insert ON public.handoffs;
CREATE POLICY handoffs_insert ON public.handoffs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Team can read coach sessions" ON public.coach_sessions;
CREATE POLICY "Team can read coach sessions" ON public.coach_sessions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Team can update coach sessions" ON public.coach_sessions;
CREATE POLICY "Team can update coach sessions" ON public.coach_sessions FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Team can create coach sessions" ON public.coach_sessions;
CREATE POLICY "Team can create coach sessions" ON public.coach_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS functional_roles_select ON public.functional_roles;
CREATE POLICY functional_roles_select ON public.functional_roles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS work_types_select ON public.work_types;
CREATE POLICY work_types_select ON public.work_types FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS work_types_insert ON public.work_types;
CREATE POLICY work_types_insert ON public.work_types FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS work_types_update ON public.work_types;
CREATE POLICY work_types_update ON public.work_types FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Everyone signed in can still read their own roles only
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- Playbooks stay readable: vendors need the safety steps, but only staff edit
DROP POLICY IF EXISTS playbooks_update ON public.playbooks;
CREATE POLICY playbooks_update ON public.playbooks FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS playbooks_insert ON public.playbooks;
CREATE POLICY playbooks_insert ON public.playbooks FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS playbook_steps_write ON public.playbook_steps;
CREATE POLICY playbook_steps_write ON public.playbook_steps FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));