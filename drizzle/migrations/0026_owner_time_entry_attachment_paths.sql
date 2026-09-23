-- Homeowners may attach several files as the paper trail for one logged
-- activity. The existing single attachment_path stays as the first file so
-- every current reader keeps working.
ALTER TABLE public.owner_time_entries
  ADD COLUMN IF NOT EXISTS attachment_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.owner_time_entries.attachment_paths IS
  'All evidence files for this entry, in upload order. attachment_path holds the first.';