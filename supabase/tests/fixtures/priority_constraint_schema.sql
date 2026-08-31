-- Minimal fixture reproducing the live priority CHECK constraints exactly as
-- they exist in production after the P4 retirement migration.
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'p3',
  CONSTRAINT tickets_priority_chk CHECK (priority = ANY (ARRAY['p1'::text,'p2'::text,'p3'::text]))
);

CREATE TABLE public.work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_priority text NOT NULL DEFAULT 'p3',
  CONSTRAINT work_types_priority_chk CHECK (default_priority = ANY (ARRAY['p1'::text,'p2'::text,'p3'::text]))
);
