-- Breezeway people directory (comment identity), work order photos,
-- and the reusable Evidence Quality Gate.

/* ---------------- Breezeway people ---------------- */
CREATE TABLE IF NOT EXISTS public.breezeway_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breezeway_person_id bigint NOT NULL UNIQUE,
  first_name text,
  last_name text,
  email text,
  active boolean NOT NULL DEFAULT true,
  resolve_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mapping_state text NOT NULL DEFAULT 'unmatched',
  is_integration_identity boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT breezeway_people_state_check
    CHECK (mapping_state IN ('matched','unmatched','ambiguous','excluded'))
);
CREATE INDEX IF NOT EXISTS breezeway_people_email_idx ON public.breezeway_people(lower(email));
CREATE INDEX IF NOT EXISTS breezeway_people_user_idx ON public.breezeway_people(resolve_user_id);

GRANT SELECT ON public.breezeway_people TO authenticated;
GRANT ALL ON public.breezeway_people TO service_role;
ALTER TABLE public.breezeway_people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view Breezeway people" ON public.breezeway_people;
CREATE POLICY "Staff can view Breezeway people"
  ON public.breezeway_people FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

/* ---------------- Outbound comment audit ---------------- */
ALTER TABLE public.breezeway_work_order_comments
  ADD COLUMN IF NOT EXISTS resolve_author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolve_author_name text,
  ADD COLUMN IF NOT EXISTS breezeway_person_id bigint,
  ADD COLUMN IF NOT EXISTS identity_mode text,
  ADD COLUMN IF NOT EXISTS delivery_state text NOT NULL DEFAULT 'mirrored',
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'breezeway';

ALTER TABLE public.breezeway_work_order_comments
  DROP CONSTRAINT IF EXISTS breezeway_comment_delivery_check;
ALTER TABLE public.breezeway_work_order_comments
  ADD CONSTRAINT breezeway_comment_delivery_check
  CHECK (delivery_state IN ('mirrored','sending','delivered','failed'));

/* ---------------- Work order photos ---------------- */
CREATE TABLE IF NOT EXISTS public.breezeway_work_order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.breezeway_work_orders(id) ON DELETE CASCADE,
  breezeway_task_id bigint NOT NULL,
  breezeway_photo_id bigint,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  url text NOT NULL,
  caption text,
  photo_type text,
  uploader text,
  breezeway_created_at timestamptz,
  source text NOT NULL DEFAULT 'breezeway',
  evidence_item_id uuid,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT breezeway_photo_source_check CHECK (source IN ('breezeway','resolve'))
);
CREATE UNIQUE INDEX IF NOT EXISTS breezeway_work_order_photos_external_uniq
  ON public.breezeway_work_order_photos(breezeway_photo_id)
  WHERE breezeway_photo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS breezeway_work_order_photos_wo_idx
  ON public.breezeway_work_order_photos(work_order_id);

GRANT SELECT ON public.breezeway_work_order_photos TO authenticated;
GRANT ALL ON public.breezeway_work_order_photos TO service_role;
ALTER TABLE public.breezeway_work_order_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view Breezeway work order photos" ON public.breezeway_work_order_photos;
CREATE POLICY "Staff can view Breezeway work order photos"
  ON public.breezeway_work_order_photos FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

/* ---------------- Evidence Quality Gate ---------------- */
CREATE TABLE IF NOT EXISTS public.evidence_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  slot_key text NOT NULL,
  label text NOT NULL,
  requirement_kind text NOT NULL DEFAULT 'general',
  instruction text,
  detail text,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'awaiting',
  accepted_item_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_requirements_subject_check
    CHECK (subject_type IN ('ticket','onboarding_task','work_order','property','assessment')),
  CONSTRAINT evidence_requirements_kind_check
    CHECK (requirement_kind IN ('general','serial_label','filter_size','completed_repair','before','after','property_feature','meter_reading','damage')),
  CONSTRAINT evidence_requirements_status_check
    CHECK (status IN ('awaiting','checking','verified','rejected','accepted_exception'))
);
CREATE UNIQUE INDEX IF NOT EXISTS evidence_requirements_slot_uniq
  ON public.evidence_requirements(subject_type, subject_id, slot_key);
CREATE INDEX IF NOT EXISTS evidence_requirements_subject_idx
  ON public.evidence_requirements(subject_type, subject_id);

CREATE TABLE IF NOT EXISTS public.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid REFERENCES public.evidence_requirements(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'resolve_upload',
  external_url text,
  breezeway_photo_id bigint,
  breezeway_task_id bigint,
  status text NOT NULL DEFAULT 'checking',
  stage_a jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage_b jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_codes text[] NOT NULL DEFAULT '{}',
  guidance text,
  evaluator text,
  evaluated_at timestamptz,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  exception_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  exception_reason text,
  exception_at timestamptz,
  original_rejection text,
  posted_to_breezeway_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_items_source_check CHECK (source IN ('resolve_upload','breezeway_photo')),
  CONSTRAINT evidence_items_status_check
    CHECK (status IN ('checking','verified','rejected','accepted_exception','unchecked'))
);
CREATE INDEX IF NOT EXISTS evidence_items_requirement_idx ON public.evidence_items(requirement_id);
CREATE INDEX IF NOT EXISTS evidence_items_created_idx ON public.evidence_items(created_at);

CREATE TABLE IF NOT EXISTS public.evidence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.evidence_items(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES public.evidence_requirements(id) ON DELETE CASCADE,
  event text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_events_item_idx ON public.evidence_events(item_id);
CREATE INDEX IF NOT EXISTS evidence_events_created_idx ON public.evidence_events(created_at);

GRANT SELECT ON public.evidence_requirements TO authenticated;
GRANT SELECT ON public.evidence_items TO authenticated;
GRANT SELECT ON public.evidence_events TO authenticated;
GRANT ALL ON public.evidence_requirements TO service_role;
GRANT ALL ON public.evidence_items TO service_role;
GRANT ALL ON public.evidence_events TO service_role;

ALTER TABLE public.evidence_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view evidence requirements" ON public.evidence_requirements;
CREATE POLICY "Staff can view evidence requirements"
  ON public.evidence_requirements FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can view evidence items" ON public.evidence_items;
CREATE POLICY "Staff can view evidence items"
  ON public.evidence_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can view evidence events" ON public.evidence_events;
CREATE POLICY "Staff can view evidence events"
  ON public.evidence_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS evidence_requirements_updated_at ON public.evidence_requirements;
CREATE TRIGGER evidence_requirements_updated_at
  BEFORE UPDATE ON public.evidence_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();