-- Handoff never blocks, part 1: a place to keep the exact flag values before they change
-- (Emily, Nov 7, 2026; register O4). Undo: 02_undo_flag_snapshot_table.sql. No BEGIN/COMMIT.
--
-- 03 (data step) copies blocks_handoff and is_required for every row it changes into this table
-- under one snapshot key before it changes anything; 03's undo restores from it. Written only by
-- the data steps; nobody signed in reads or writes it.

CREATE TABLE public.onboarding_flag_snapshots (
  snapshot_key text NOT NULL,
  table_name text NOT NULL CHECK (table_name IN ('onboarding_template_tasks', 'onboarding_tasks')),
  row_id uuid NOT NULL,
  blocks_handoff boolean NOT NULL,
  is_required boolean NOT NULL,
  updated_at timestamptz,
  taken_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_key, table_name, row_id)
);
COMMENT ON TABLE public.onboarding_flag_snapshots IS
  'Exact handoff flag values saved before a decided bulk change, so its undo restores them. Written only by staged data steps.';

GRANT ALL ON public.onboarding_flag_snapshots TO service_role;
ALTER TABLE public.onboarding_flag_snapshots ENABLE ROW LEVEL SECURITY;
