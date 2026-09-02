-- 1. Playbook read: internal staff only
DROP POLICY IF EXISTS playbooks_select ON public.playbooks;
CREATE POLICY playbooks_select ON public.playbooks FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS playbook_steps_select ON public.playbook_steps;
CREATE POLICY playbook_steps_select ON public.playbook_steps FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2. Playbook authoring: supervisors only
DROP POLICY IF EXISTS playbooks_insert ON public.playbooks;
CREATE POLICY playbooks_insert ON public.playbooks FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()));

DROP POLICY IF EXISTS playbooks_update ON public.playbooks;
CREATE POLICY playbooks_update ON public.playbooks FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

DROP POLICY IF EXISTS playbook_steps_write ON public.playbook_steps;
CREATE POLICY playbook_steps_write ON public.playbook_steps FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

-- 3. Coach sessions: update only your own, supervisors may correct any
DROP POLICY IF EXISTS "Team can update coach sessions" ON public.coach_sessions;
CREATE POLICY "Team can update coach sessions" ON public.coach_sessions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_supervisor(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_supervisor(auth.uid()));

-- 4. Authored Playbook metadata and guidance (Coach-shaped)
ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS playbook_key text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS effective_on date,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS applies_to text[] NOT NULL DEFAULT ARRAY['ticket']::text[],
  ADD COLUMN IF NOT EXISTS matcher jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS priority_reason text,
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS immediate_actions text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS escalate_if text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS vendor_brief jsonb;

ALTER TABLE public.playbooks DROP CONSTRAINT IF EXISTS playbooks_status_check;
ALTER TABLE public.playbooks ADD CONSTRAINT playbooks_status_check
  CHECK (status IN ('draft','active','retired'));

UPDATE public.playbooks
   SET playbook_key = COALESCE(playbook_key, category || '_' || left(regexp_replace(lower(title), '[^a-z0-9]+', '_', 'g'), 40)),
       status = CASE WHEN active THEN 'active' ELSE 'retired' END
 WHERE playbook_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS playbooks_key_version_idx
  ON public.playbooks (playbook_key, version);