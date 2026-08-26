-- 1. Participation entry review workflow -------------------------------------
ALTER TABLE public.owner_time_entries
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.owner_time_entries
    ADD CONSTRAINT owner_time_entries_review_status_chk
    CHECK (review_status IN ('submitted','approved','returned','flagged'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Supervisors review owner time entries" ON public.owner_time_entries;
CREATE POLICY "Supervisors review owner time entries"
  ON public.owner_time_entries FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'manager'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'manager'));

-- 2. Owner-opened matters ------------------------------------------------------
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS owner_participation_path text,
  ADD COLUMN IF NOT EXISTS owner_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_submitted_by uuid;

DO $$ BEGIN
  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_owner_participation_path_chk
    CHECK (owner_participation_path IS NULL
           OR owner_participation_path IN ('inform','consult','approve','emergency'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Owners open matters at their own home" ON public.tickets;
CREATE POLICY "Owners open matters at their own home"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    property_id IS NOT NULL
    AND private.owner_sees_property(auth.uid(), property_id)
    AND created_by = auth.uid()
    AND owner_submitted = true
    AND owner_submitted_by = auth.uid()
    AND initiator_type = 'owner'
  );

-- 3. Archive-not-delete + demo marking on program records ----------------------
ALTER TABLE public.owner_programs
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.owner_program_properties
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.owner_reviews
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 4. Configurable, auditable program rules -------------------------------------
CREATE TABLE IF NOT EXISTS public.owner_program_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.owner_program_rules TO authenticated;
GRANT INSERT, UPDATE ON public.owner_program_rules TO authenticated;
GRANT ALL ON public.owner_program_rules TO service_role;

ALTER TABLE public.owner_program_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read program rules"
  ON public.owner_program_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors change program rules"
  ON public.owner_program_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'manager'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'manager'));

CREATE TRIGGER owner_program_rules_updated
  BEFORE UPDATE ON public.owner_program_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.audit_owner_program_rule_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (auth.uid(), 'owner_program_rule_' || lower(TG_OP), 'owner_program_rule',
          COALESCE(NEW.id, OLD.id), COALESCE(NEW.key, OLD.key),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER owner_program_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.owner_program_rules
  FOR EACH ROW EXECUTE FUNCTION public.audit_owner_program_rule_change();

INSERT INTO public.owner_program_rules (key, label, description, value) VALUES
  ('target_hours', 'Participation target (hours)', 'Total owner-reported hours the program works toward.', '{"hours": 100}'::jsonb),
  ('program_window_days', 'Program window (days)', 'Length of the participation window, counted from the program start date.', '{"days": 90}'::jsonb),
  ('concurrent_property_rule', 'Concurrent property rule', 'When enabled, an owner with qualifying concurrent properties works toward one combined target across them. When disabled, each property carries its own target.', '{"combined": true, "per_property_hours": 100}'::jsonb),
  ('milestones', 'Milestones', 'Progress milestones shown to the homeowner, in reported hours.', '{"hours": [25, 50, 75, 100]}'::jsonb),
  ('at_risk_thresholds', 'At-risk thresholds', 'Hours behind the expected pace that mark a program slightly behind, action needed, or significantly behind.', '{"slightly_behind": 1, "action_needed": 5, "significantly_behind": 10, "grace_days": 7}'::jsonb),
  ('review_required', 'Reviewer approval required', 'When enabled, owner-reported entries need an internal reviewer decision before they count as approved. Entries are never altered by the system.', '{"required": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Demo owner program: admin-triggered, archive-never-delete -----------------
CREATE OR REPLACE FUNCTION public.archive_demo_owner_program(_actor uuid DEFAULT NULL::uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who uuid := COALESCE(auth.uid(), _actor);
BEGIN
  IF NOT public.has_role(who, 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can manage the demo environment.';
  END IF;

  UPDATE public.owner_time_entries SET is_demo = true
   WHERE program_id IN (SELECT id FROM public.owner_programs WHERE is_demo);
  UPDATE public.owner_reviews SET archived_at = COALESCE(archived_at, now())
   WHERE is_demo AND archived_at IS NULL;
  UPDATE public.owner_program_properties SET archived_at = COALESCE(archived_at, now())
   WHERE is_demo AND archived_at IS NULL;
  UPDATE public.owner_programs
     SET archived_at = COALESCE(archived_at, now()),
         archived_by = COALESCE(archived_by, who),
         archive_reason = COALESCE(archive_reason, 'Demo owner program archived by admin'),
         status = 'closed'
   WHERE is_demo AND archived_at IS NULL;
  UPDATE public.tickets
     SET archived_at = COALESCE(archived_at, now()),
         archive_reason = COALESCE(archive_reason, 'Demo owner program archived by admin'),
         archived_by = COALESCE(archived_by, who)
   WHERE is_demo AND owner_submitted AND archived_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.seed_demo_owner_program(_actor uuid DEFAULT NULL::uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who uuid := COALESCE(auth.uid(), _actor);
  p_one uuid; p_two uuid; prog uuid; t_matter uuid; r_one uuid;
BEGIN
  IF NOT public.has_role(who, 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can seed the demo environment.';
  END IF;

  PERFORM public.archive_demo_owner_program(who);

  INSERT INTO public.properties (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, is_demo)
  VALUES ('DEMO — Owner Program Harbor House','DEMO Harbor','10 Sample Way','Nashville','TN','37206','demo',false,'active_operations','', true)
  RETURNING id INTO p_one;

  INSERT INTO public.properties (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, is_demo)
  VALUES ('DEMO — Owner Program Ridge Cabin','DEMO Ridge','11 Sample Way','Franklin','TN','37064','demo',false,'active_operations','', true)
  RETURNING id INTO p_two;

  INSERT INTO public.owner_programs
    (property_id, owner_user_id, owner_name, owner_email, status, started_on, ends_on, target_hours, is_demo, internal_notes)
  VALUES
    (p_one, NULL, 'DEMO Owner (not a real person)', 'demo-owner@example.invalid', 'active',
     current_date - 30, current_date + 59, 100, true,
     'Fictional demo program. Two concurrent demo homes working toward one combined 100-hour target.')
  RETURNING id INTO prog;

  INSERT INTO public.owner_program_properties
    (program_id, property_id, closing_date, closing_confirmed, added_on, inclusion_status, onboarding_status, launch_status, is_demo)
  VALUES
    (prog, p_one, current_date - 30, true, current_date - 30, 'included', 'complete', 'launched', true),
    (prog, p_two, current_date - 20, true, current_date - 20, 'included', 'in_progress', 'preparing', true);

  INSERT INTO public.owner_reviews
    (program_id, phase, stage, title, task_type, property_id, recommendation, business_question, impact, decision_path, respond_by, status, sort_order, is_demo)
  VALUES
    (prog, 'onboarding', 'setup', 'DEMO — Approve the pricing floor for the first season', 'property_specific', p_one,
     'Set a $189 weekday floor for the first 60 days.', 'Do you approve this floor?',
     'Protects rate integrity while reviews build.', 'approve', current_date + 5, 'awaiting_owner', 1, true)
  RETURNING id INTO r_one;

  INSERT INTO public.owner_reviews
    (program_id, phase, stage, title, task_type, property_id, recommendation, business_question, impact, decision_path, respond_by, status, sort_order, is_demo)
  VALUES
    (prog, 'ongoing', 'operations', 'DEMO — Review the quarterly cleaning report', 'program_wide', NULL,
     'Read the quarterly summary for both demo homes.', 'Anything you want changed?',
     'Keeps the owner informed without a decision gate.', 'inform', current_date + 12, 'awaiting_owner', 2, true);

  INSERT INTO public.owner_time_entries
    (program_id, owner_user_id, phase, entry_date, minutes, activity, activity_category, output, comments, attested, review_status, reviewed_by, reviewed_at, review_note, is_demo)
  VALUES
    (prog, NULL, 'onboarding', current_date - 26, 120, 'DEMO — Reviewed and approved the listing copy and photo set.', 'listing', 'Approved with two caption edits.', NULL, true, 'approved', who, now() - interval '20 days', 'Clear description and a decision recorded.', true),
    (prog, NULL, 'onboarding', current_date - 18, 90, 'DEMO — Walked both homes with the onboarding lead.', 'inspection', 'Punch list agreed.', NULL, true, 'submitted', NULL, NULL, NULL, true),
    (prog, NULL, 'ongoing', current_date - 6, 45, 'DEMO — Call about the pricing floor.', 'pricing', 'Decision pending.', NULL, true, 'returned', who, now() - interval '3 days', 'Please add which home this call covered before we approve it.', true);

  INSERT INTO public.owner_time_entry_properties (entry_id, property_id)
  SELECT e.id, p_one FROM public.owner_time_entries e WHERE e.program_id = prog;

  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, property_id, created_by, reported_at, response_due_at, due_at, handoff_status, initiator_type,
     owner_participation_path, owner_submitted, owner_submitted_by, ref, is_demo)
  VALUES
    ('DEMO — Owner asks about a slow bathroom drain','Fictional demo matter opened by a demo homeowner on the Consult path.','maintenance','same_day_operations','p3','open','ticket','owner','none','vacant',
     false, p_one, who, now() - interval '2 days', now() - interval '2 days' + interval '4 hours', now() + interval '3 days',
     'not_started','owner','consult', true, who, 900100, true)
  RETURNING id INTO t_matter;

  RETURN prog;
END; $$;