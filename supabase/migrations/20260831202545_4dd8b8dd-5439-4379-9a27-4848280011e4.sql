ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_priority_chk;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_priority_chk CHECK (priority = ANY (ARRAY['p1'::text,'p2'::text,'p3'::text]));

ALTER TABLE public.work_types DROP CONSTRAINT IF EXISTS work_types_priority_chk;
ALTER TABLE public.work_types ADD CONSTRAINT work_types_priority_chk CHECK (default_priority = ANY (ARRAY['p1'::text,'p2'::text,'p3'::text]));