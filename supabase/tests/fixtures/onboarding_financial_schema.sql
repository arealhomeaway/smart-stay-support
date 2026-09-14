-- Isolated fixture only.
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY, property_id uuid, entity_type text, entity_id uuid,
  status text, decision_note text, decided_at timestamptz
);
CREATE TABLE public.financial_requests (
  id uuid PRIMARY KEY, property_id uuid, project_id uuid, approval_id uuid,
  title text, status text, estimate_amount numeric, approved_amount numeric,
  approved_at timestamptz, invoice_amount numeric, updated_at timestamptz,
  is_demo boolean DEFAULT true
);
