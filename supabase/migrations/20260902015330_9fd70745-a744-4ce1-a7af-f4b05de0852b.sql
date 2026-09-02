ALTER TABLE public.guest_recovery
  ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT 'ARHA Operations Policy Thresholds for Resolve — v1',
  ADD COLUMN IF NOT EXISTS within_airbnb_policy boolean,
  ADD COLUMN IF NOT EXISTS escalation_flags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS guest_requested_amount numeric,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approval_authority text,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS issued_by uuid,
  ADD COLUMN IF NOT EXISTS issued_on date,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'p3',
  ADD COLUMN IF NOT EXISTS corrective_action text,
  ADD COLUMN IF NOT EXISTS unresolved_concern text,
  ADD COLUMN IF NOT EXISTS final_communication_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_guest_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS promised_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS temporary_mitigation text,
  ADD COLUMN IF NOT EXISTS mitigation_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guest_requested_supervisor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supervisor_engaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS supervisor_escalation_reason text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid,
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS handoff_to uuid,
  ADD COLUMN IF NOT EXISTS handoff_status text,
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS handoff_next_action text,
  ADD COLUMN IF NOT EXISTS handoff_due timestamptz,
  ADD COLUMN IF NOT EXISTS handoff_accepted_at timestamptz;

ALTER TABLE public.guest_recovery
  DROP CONSTRAINT IF EXISTS guest_recovery_priority_check;
ALTER TABLE public.guest_recovery
  ADD CONSTRAINT guest_recovery_priority_check CHECK (priority IN ('p1','p2','p3'));

ALTER TABLE public.guest_recovery
  DROP CONSTRAINT IF EXISTS guest_recovery_approval_status_check;
ALTER TABLE public.guest_recovery
  ADD CONSTRAINT guest_recovery_approval_status_check
  CHECK (approval_status IN ('not_required','pending','approved','declined','returned'));

ALTER TABLE public.guest_recovery
  DROP CONSTRAINT IF EXISTS guest_recovery_handoff_status_check;
ALTER TABLE public.guest_recovery
  ADD CONSTRAINT guest_recovery_handoff_status_check
  CHECK (handoff_status IS NULL OR handoff_status IN ('requested','accepted','declined','cancelled'));

CREATE INDEX IF NOT EXISTS guest_recovery_approval_status_idx ON public.guest_recovery (approval_status);
CREATE INDEX IF NOT EXISTS guest_recovery_stage_idx ON public.guest_recovery (stage);