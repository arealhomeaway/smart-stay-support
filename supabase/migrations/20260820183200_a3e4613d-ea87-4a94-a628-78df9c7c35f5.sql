ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS breezeway_property_id text,
  ADD COLUMN IF NOT EXISTS breezeway_synced_at timestamptz;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS breezeway_task_id text,
  ADD COLUMN IF NOT EXISTS breezeway_task_url text,
  ADD COLUMN IF NOT EXISTS breezeway_task_status text,
  ADD COLUMN IF NOT EXISTS breezeway_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS properties_breezeway_property_id_idx ON public.properties (breezeway_property_id);
CREATE INDEX IF NOT EXISTS tickets_breezeway_task_id_idx ON public.tickets (breezeway_task_id);