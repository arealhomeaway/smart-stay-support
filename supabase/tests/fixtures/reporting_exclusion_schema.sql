-- Minimal fixture schema for supabase/tests/reporting_exclusion.test.sql.
-- Only the columns the Track 0 reporting-exclusion fixes actually filter on.

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  reported_at timestamptz NOT NULL DEFAULT now()
);

-- No is_demo/archived_at column of its own — matches the real schema. The
-- only way to exclude a demo/archived ticket's rating is via ticket_id.
CREATE TABLE IF NOT EXISTS public.vendor_job_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id),
  vendor_user_id uuid NOT NULL,
  overall numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
