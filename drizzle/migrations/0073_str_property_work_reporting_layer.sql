-- Extensible STR reporting: non-owner individuals' work by person + property.
-- The cleaner ledger and safeguard are unchanged; they remain the only input
-- to cleaner safeguard states. Future sources write here and are consolidated
-- with cleaner time through property_person_activity.

COMMENT ON TABLE public.cleaner_workers IS
  'Canonical directory of non-owner individuals (and company accounts) who perform property work. Cleaners today; field staff, vendor technicians and others reuse the same identity.';
ALTER TABLE public.cleaner_workers
  ADD COLUMN IF NOT EXISTS person_kinds text[] NOT NULL DEFAULT ARRAY['cleaner']::text[],
  ADD COLUMN IF NOT EXISTS staff_user_id uuid,
  ADD COLUMN IF NOT EXISTS vendor_org_id uuid REFERENCES public.vendor_orgs(id);

CREATE TABLE public.property_work_sources (
  code text PRIMARY KEY,
  label text NOT NULL,
  activity_category text NOT NULL,
  counts_toward_cleaner_safeguard boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_work_sources TO authenticated;
GRANT ALL ON public.property_work_sources TO service_role;
ALTER TABLE public.property_work_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads work sources" ON public.property_work_sources FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

INSERT INTO public.property_work_sources(code, label, activity_category, counts_toward_cleaner_safeguard, active) VALUES
  ('breezeway_housekeeping','Breezeway housekeeping Task','cleaning', true, true),
  ('manual_cleaning','Off-Breezeway clean (manual)','cleaning', true, true),
  ('breezeway_maintenance','Breezeway maintenance Task','maintenance', false, false),
  ('breezeway_inspection','Breezeway inspection Task','inspection', false, false),
  ('resolve_task','Resolve Task','operations', false, false),
  ('vendor_work_order','Vendor Work Order','vendor', false, false),
  ('field_staff','Field staff visit','field', false, false),
  ('manual_work','Manually recorded work','other', false, false);

CREATE TABLE public.property_work_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_key text NOT NULL,
  source_code text NOT NULL REFERENCES public.property_work_sources(code),
  source_ref text,
  person_id uuid NOT NULL REFERENCES public.cleaner_workers(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  work_date date NOT NULL,
  minutes numeric(8,2) NOT NULL CHECK (minutes >= 0 AND minutes <= 1440),
  method text NOT NULL,
  confidence text NOT NULL DEFAULT 'medium',
  review_state text NOT NULL DEFAULT 'auto',
  reason text,
  supersedes_id uuid REFERENCES public.property_work_records(id),
  superseded_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_fixture boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX property_work_records_active_key ON public.property_work_records(record_key) WHERE superseded_at IS NULL;
CREATE INDEX property_work_records_person_property ON public.property_work_records(property_id, person_id, work_date);
GRANT SELECT ON public.property_work_records TO authenticated;
GRANT ALL ON public.property_work_records TO service_role;
ALTER TABLE public.property_work_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads work records" ON public.property_work_records FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

-- Append-only: only superseding is allowed; cleaning sources stay in the cleaner ledger.
CREATE OR REPLACE FUNCTION private.guard_property_work_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Work records are append-only.'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'superseded_at') IS DISTINCT FROM (to_jsonb(OLD) - 'superseded_at') OR OLD.superseded_at IS NOT NULL THEN
      RAISE EXCEPTION 'Work records are append-only; add a superseding record instead.';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.property_work_sources s WHERE s.code = NEW.source_code AND s.counts_toward_cleaner_safeguard) THEN
    RAISE EXCEPTION 'Cleaning time is recorded in the cleaner ledger, not here.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_property_work_record BEFORE INSERT OR UPDATE OR DELETE ON public.property_work_records
  FOR EACH ROW EXECUTE FUNCTION private.guard_property_work_record();

-- One consolidated read: every active, counted work record by person + property.
CREATE VIEW public.property_person_activity WITH (security_invoker = true) AS
  SELECT l.id AS record_id, 'cleaner_ledger'::text AS origin,
         CASE WHEN l.attribution_method = 'manual_entry' THEN 'manual_cleaning' ELSE 'breezeway_housekeeping' END AS source_code,
         'cleaning'::text AS activity_category,
         l.breezeway_task_id::text AS source_ref, l.worker_id AS person_id, l.property_id, l.completion_date AS work_date,
         l.attributed_minutes AS minutes, l.attribution_method AS method, l.review_state, l.is_fixture
    FROM public.cleaner_exposure_ledger l
   WHERE l.superseded_at IS NULL AND l.counted
  UNION ALL
  SELECT r.id, 'work_records', r.source_code, s.activity_category, r.source_ref, r.person_id, r.property_id, r.work_date,
         r.minutes, r.method, r.review_state, r.is_fixture
    FROM public.property_work_records r JOIN public.property_work_sources s ON s.code = r.source_code
   WHERE r.superseded_at IS NULL;
GRANT SELECT ON public.property_person_activity TO authenticated;
GRANT SELECT ON public.property_person_activity TO service_role;