ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS repair_reported_incomplete_at timestamptz;