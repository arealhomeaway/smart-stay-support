ALTER TABLE public.breezeway_outbound_tasks
  ADD COLUMN IF NOT EXISTS template_id integer,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS assignee_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignee_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolve_evidence_note text;