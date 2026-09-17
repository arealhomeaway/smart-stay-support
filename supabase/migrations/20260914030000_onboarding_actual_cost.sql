-- Unapplied. Invoice and actual paid amount are distinct facts; no backfill
-- guesses that an invoice was paid, and no existing grants/RLS are changed.
ALTER TABLE public.financial_requests
  ADD COLUMN actual_amount numeric(12,2) CHECK (actual_amount >= 0),
  ADD COLUMN actual_recorded_at timestamptz,
  ADD COLUMN actual_recorded_by uuid;
