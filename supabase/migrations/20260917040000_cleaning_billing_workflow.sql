-- UNAPPLIED. Synthetic-only billing workflow foundation; no charge or delivery code.
-- Requires cleaning foundation and ingestion migrations in isolated staging.
CREATE TABLE public.cleaning_billing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaning_review_id uuid NOT NULL REFERENCES public.cleaning_reviews(id),
  turnover_id uuid REFERENCES public.cleaning_turnovers(id),
  cleaning_task_id uuid REFERENCES public.cleaning_tasks(id),
  inspection_task_id uuid REFERENCES public.cleaning_tasks(id),
  reservation_ref text NOT NULL,
  booking_channel text NOT NULL,
  requesting_pc_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','evidence_needed','submitted_for_supervisor_review','returned_for_correction',
     'supervisor_approved','supervisor_rejected','escalated_to_director',
     'director_approved','director_rejected','ready_for_finance','finance_processing',
     'executed','partially_recovered','unable_to_recover','cancelled','closed')),
  original_proposed_amount numeric(12,2) NOT NULL CHECK (original_proposed_amount >= 0),
  current_proposed_amount numeric(12,2) NOT NULL CHECK (current_proposed_amount >= 0),
  approved_amount numeric(12,2) CHECK (approved_amount >= 0),
  actual_executed_amount numeric(12,2) CHECK (actual_executed_amount >= 0),
  deposit_amount numeric(12,2) CHECK (deposit_amount >= 0),
  deposit_source text,
  proposed_deposit_action text NOT NULL DEFAULT 'none' CHECK (proposed_deposit_action IN ('none','withhold','release','refund')),
  approved_deposit_action text CHECK (approved_deposit_action IN ('none','withhold','release','refund')),
  executed_deposit_action text CHECK (executed_deposit_action IN ('none','withhold','release','refund')),
  finding_codes text[] NOT NULL DEFAULT '{}',
  evidence_refs text[] NOT NULL DEFAULT '{}',
  cleaner_statement text,
  inspector_statement text,
  proposed_calculation text,
  supporting_invoice_or_estimate text,
  guest_communication_draft text,
  accounting_notification_draft text,
  guest_communication_sent_ref text,
  accounting_notification_sent_ref text,
  ownerrez_notes_confirmed boolean NOT NULL DEFAULT false,
  resolution_center_reference text,
  execution_evidence_refs text[] NOT NULL DEFAULT '{}',
  requires_director boolean NOT NULL DEFAULT false,
  variance_reason text,
  supervisor_reviewer_id uuid REFERENCES auth.users(id),
  director_approver_id uuid REFERENCES auth.users(id),
  finance_executor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('executed','partially_recovered','unable_to_recover','closed')
    OR (approved_amount IS NOT NULL AND actual_executed_amount IS NOT NULL
      AND executed_deposit_action IS NOT NULL AND cardinality(execution_evidence_refs)>0)),
  CHECK (actual_executed_amount IS NULL OR approved_amount IS NOT NULL),
  CHECK (actual_executed_amount IS NULL OR actual_executed_amount=approved_amount),
  CHECK (executed_deposit_action IS NULL OR executed_deposit_action=approved_deposit_action)
);

CREATE TABLE public.cleaning_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.cleaning_billing_requests(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  actor_role text NOT NULL,
  action text NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason))>0),
  amount numeric(12,2),
  evidence_refs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cleaning_billing_request_findings (
  request_id uuid NOT NULL REFERENCES public.cleaning_billing_requests(id),
  finding_id uuid NOT NULL REFERENCES public.cleaning_review_findings(id),
  PRIMARY KEY (request_id,finding_id)
);
CREATE INDEX cleaning_billing_review_idx ON public.cleaning_billing_requests(cleaning_review_id,status);
CREATE INDEX cleaning_billing_events_request_idx ON public.cleaning_billing_events(request_id,created_at);

-- No browser read or write grant yet. Billing is sensitive; service implementation
-- must perform current-role checks and append the audit event atomically.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cleaning_billing_requests','cleaning_billing_events','cleaning_billing_request_findings'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
