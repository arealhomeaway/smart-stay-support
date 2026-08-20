ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_status text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_external_unique
  ON public.tickets (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;