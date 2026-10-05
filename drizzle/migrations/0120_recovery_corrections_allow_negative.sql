-- Correcting entries are negative rows tied to an original receipt; originals stay non-negative.
ALTER TABLE public.expense_recoveries DROP CONSTRAINT IF EXISTS expense_recoveries_received_amount_check;
ALTER TABLE public.expense_recoveries ADD CONSTRAINT expense_recoveries_received_amount_check
  CHECK (received_amount >= 0 OR corrects_id IS NOT NULL);