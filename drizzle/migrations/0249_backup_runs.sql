-- Nightly backup, Step 1: run history table (rebuilt Nov 5 2026 from the backup code).
-- Written only by the server backup job (service role). Admins can read it on Admin > Integrations.
CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_name text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  trigger text NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule','manual')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  folder_item_id text,
  files jsonb,
  pruned_count integer,
  pruned_at timestamptz,
  error text
);
CREATE INDEX backup_runs_started_idx ON public.backup_runs (started_at DESC);
CREATE INDEX backup_runs_folder_idx ON public.backup_runs (folder_name, status);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read backup runs" ON public.backup_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
