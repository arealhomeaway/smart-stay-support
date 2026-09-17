-- Operations cleaning foundation. UNAPPLIED: validate in isolated staging before any deployment.
-- Approved decisions: Operations implementation request, 2026-09-17.
-- This schema stores task history but does not schedule live jobs or contact vendors.

CREATE TABLE public.cleaning_template_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_template_id integer NOT NULL UNIQUE,
  name text NOT NULL,
  workflow_kind text NOT NULL CHECK (workflow_kind IN ('departure','quality_arrival','vacancy')),
  market_scope text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('active','legacy','unused','review_needed')),
  checklist_version text NOT NULL DEFAULT 'source-2026-08-27',
  source_file text NOT NULL DEFAULT 'ARHA_Breezeway_Full_Workflows (3).docx',
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.cleaning_template_refs (external_template_id,name,workflow_kind,market_scope,classification) VALUES
 (581109,'ARHA Departure Clean (Updated)','departure','OKC','active'),
 (581110,'Non- OKC ARHA Departure Clean (Updated)','departure','non-OKC','active'),
 (32834,'ARHA Quality and Arrival Inspection','quality_arrival','all','active'),
 (818192,'ARHA Vacancy Cleaning','vacancy','all','active'),
 (32833,'ARHA Departure Clean','departure','OKC','legacy'),
 (243197,'Non-OKC ARHA Departure Clean','departure','non-OKC','legacy'),
 (588039,'ARHA Quality and Arrival Inspection (Suggested Updates)','quality_arrival','all','unused'),
 (277186,'ARHA Quality and Arrival Inspection (off-site)','quality_arrival','all','review_needed');

CREATE TABLE public.operations_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL,
  tag_type text NOT NULL, market_scope text, property_id uuid REFERENCES public.properties(id),
  source_system text NOT NULL, external_code text, lifecycle text NOT NULL CHECK (lifecycle IN ('active','legacy','verification_needed')),
  effective_from date, effective_to date, template_ref_id uuid REFERENCES public.cleaning_template_refs(id),
  workflow text, verification_status text NOT NULL DEFAULT 'NEEDS LIVE VERIFICATION',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_code)
);
INSERT INTO public.operations_tags (display_name,tag_type,source_system,lifecycle,verification_status) VALUES
 ('Blackstone Grill Cleaning','property','Breezeway','verification_needed','NEEDS LIVE VERIFICATION'),
 ('HOA Managed Lawn Care Check-in','property','Breezeway','verification_needed','NEEDS LIVE VERIFICATION');

CREATE TABLE public.cleaning_turnovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  reservation_external_ref text NOT NULL,
  official_checkout_date date NOT NULL,
  guest_name text,
  ownerrez_booking_ref text,
  departure_template_ref_id uuid NOT NULL REFERENCES public.cleaning_template_refs(id),
  created_by uuid REFERENCES auth.users(id),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id,reservation_external_ref)
);

CREATE TABLE public.cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turnover_id uuid REFERENCES public.cleaning_turnovers(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  template_ref_id uuid NOT NULL REFERENCES public.cleaning_template_refs(id),
  task_kind text NOT NULL CHECK (task_kind IN ('departure','quality_arrival','vacancy')),
  state text NOT NULL DEFAULT 'scheduled' CHECK (state IN
   ('scheduled','offered','pending_acceptance','accepted','in_progress','submitted','pending_review','approved','correction_required','reopened_in_progress','declined','expired','closed_cancelled')),
  assigned_user_id uuid REFERENCES auth.users(id),
  assigned_vendor_org_id uuid REFERENCES public.vendor_orgs(id),
  scheduled_for timestamptz,
  accepted_at timestamptz, started_at timestamptz, submitted_at timestamptz, approved_at timestamptz,
  checklist_version text NOT NULL,
  correction_round integer NOT NULL DEFAULT 0 CHECK (correction_round >= 0),
  external_work_order_ref text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (turnover_id IS NOT NULL OR task_kind = 'vacancy')
);
CREATE UNIQUE INDEX cleaning_one_open_task_per_turn_kind ON public.cleaning_tasks(turnover_id,task_kind)
 WHERE turnover_id IS NOT NULL AND state <> 'closed_cancelled';

CREATE TABLE public.cleaning_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.cleaning_tasks(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id), event_kind text NOT NULL,
  from_state text, to_state text, assigned_user_id uuid REFERENCES auth.users(id),
  assigned_vendor_org_id uuid REFERENCES public.vendor_orgs(id),
  comment text, decision text, correction_round integer NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cleaning_checklist_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.cleaning_tasks(id),
  checklist_version text NOT NULL, source_paragraph integer NOT NULL,
  answer jsonb NOT NULL, evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  requirement_applies boolean NOT NULL DEFAULT true,
  exception_id uuid,
  answered_by uuid NOT NULL REFERENCES auth.users(id), answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id,checklist_version,source_paragraph)
);

CREATE TABLE public.cleaning_evidence_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.cleaning_tasks(id),
  authorized_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  affected_requirement text NOT NULL, supporting_evidence jsonb NOT NULL,
  follow_up_obligation text NOT NULL CHECK (length(trim(follow_up_obligation)) > 0),
  authorized_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cleaning_checklist_answers ADD CONSTRAINT cleaning_answer_exception_fk
 FOREIGN KEY (exception_id) REFERENCES public.cleaning_evidence_exceptions(id);

CREATE TABLE public.cleaning_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  turnover_id uuid REFERENCES public.cleaning_turnovers(id),
  departure_task_id uuid NOT NULL REFERENCES public.cleaning_tasks(id),
  inspection_task_id uuid REFERENCES public.cleaning_tasks(id),
  cleaner_user_id uuid REFERENCES auth.users(id),
  cleaner_vendor_org_id uuid REFERENCES public.vendor_orgs(id),
  reviewer_id uuid REFERENCES auth.users(id),
  guest_name text, ownerrez_booking_ref text,
  breezeway_work_order_ref text, official_checkout_date date NOT NULL,
  work_order_reviewed boolean NOT NULL DEFAULT false,
  deposit_paid boolean, deposit_amount numeric(12,2) CHECK (deposit_amount >= 0),
  property_issue_identified boolean NOT NULL DEFAULT false, property_issue_details text,
  guest_billing_required boolean,
  guest_accounting_notification_required boolean,
  guest_accounting_notification_completed boolean NOT NULL DEFAULT false,
  ownerrez_booking_notes_completed boolean NOT NULL DEFAULT false,
  related_ticket_id uuid REFERENCES public.tickets(id),
  related_work_order_id uuid REFERENCES public.work_orders(id),
  related_claim_id uuid REFERENCES public.claims(id),
  review_date date, status text NOT NULL DEFAULT 'pending_review',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb, correction_requirement text,
  final_outcome text, deposit_action text, deposit_decided_by uuid REFERENCES auth.users(id),
  deposit_decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deposit_action IS NULL OR (deposit_decided_by IS NOT NULL AND deposit_decided_at IS NOT NULL))
);

CREATE TABLE public.cleaning_finding_codes (
  code text PRIMARY KEY, display_name text NOT NULL, active boolean NOT NULL DEFAULT true,
  source_form text NOT NULL DEFAULT '[Rezgani] Cleaning Review Log.json'
);
INSERT INTO public.cleaning_finding_codes (code,display_name) VALUES
 ('CARPET_STAIN','Carpet stain'),('EXTRA_CLEANING','Extra cleaning'),
 ('MINOR_CAT_DAMAGE','Minor cat damage'),('MAJOR_CAT_DAMAGE','Major cat damage'),
 ('MINOR_DOG_DAMAGE','Minor dog damage'),('MAJOR_DOG_DAMAGE','Major dog damage'),
 ('EXCESSIVE_PET_HAIR','Excessive pet hair'),('LINEN_OR_TOWEL_DAMAGE','Linen or towel damage'),
 ('SMOKING_MARIJUANA','Smoking marijuana'),('SMOKING_CIGARETTES','Smoking cigarettes'),
 ('FURNITURE_DAMAGE','Furniture damage'),('RUG_DAMAGE','Rug damage'),
 ('LATE_CHECKOUT_UNDER_ONE_HOUR','Late checkout under one hour'),
 ('LATE_CHECKOUT_OVER_ONE_HOUR','Late checkout over one hour');

CREATE TABLE public.cleaning_review_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL REFERENCES public.cleaning_reviews(id),
  code text NOT NULL REFERENCES public.cleaning_finding_codes(code), notes text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_cost numeric(12,2) CHECK (estimated_cost >= 0),
  actual_cost numeric(12,2) CHECK (actual_cost >= 0),
  guest_billable_decision text NOT NULL DEFAULT 'undecided' CHECK (guest_billable_decision IN ('undecided','yes','no')),
  billable_decided_by uuid REFERENCES auth.users(id), billable_decided_at timestamptz,
  deposit_impact text, claim_status text,
  related_ticket_id uuid REFERENCES public.tickets(id),
  related_work_order_id uuid REFERENCES public.work_orders(id),
  related_claim_id uuid REFERENCES public.claims(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (guest_billable_decision = 'undecided' OR (billable_decided_by IS NOT NULL AND billable_decided_at IS NOT NULL))
);

CREATE TABLE public.cleaning_supervisor_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), work_date date NOT NULL,
  supervisor_id uuid NOT NULL REFERENCES auth.users(id),
  qc_inspections_count integer NOT NULL DEFAULT 0 CHECK (qc_inspections_count >= 0),
  short_stay_clean_count integer NOT NULL DEFAULT 0 CHECK (short_stay_clean_count >= 0),
  long_stay_clean_count integer NOT NULL DEFAULT 0 CHECK (long_stay_clean_count >= 0),
  quarterly_inspection_count integer NOT NULL DEFAULT 0 CHECK (quarterly_inspection_count >= 0),
  ad_hoc_task_count integer NOT NULL DEFAULT 0 CHECK (ad_hoc_task_count >= 0),
  errands jsonb NOT NULL DEFAULT '[]'::jsonb,
  director_notes text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed')),
  reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_date,supervisor_id)
);

-- Conservative initial access: staff only. Cleaner/vendor access and transition RPCs
-- require synthetic role/RLS acceptance before exposure. No owner or vendor table grant.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cleaning_template_refs','operations_tags','cleaning_turnovers',
  'cleaning_tasks','cleaning_task_events','cleaning_checklist_answers',
  'cleaning_evidence_exceptions','cleaning_reviews','cleaning_finding_codes',
  'cleaning_review_findings','cleaning_supervisor_daily_logs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.is_staff(auth.uid()))',t||'_staff_read',t);
 END LOOP;
END $$;

CREATE INDEX cleaning_turnovers_property_date_idx ON public.cleaning_turnovers(property_id,official_checkout_date DESC);
CREATE INDEX cleaning_tasks_property_state_idx ON public.cleaning_tasks(property_id,state);
CREATE INDEX cleaning_task_events_task_time_idx ON public.cleaning_task_events(task_id,created_at);
CREATE INDEX cleaning_reviews_property_date_idx ON public.cleaning_reviews(property_id,official_checkout_date DESC);
