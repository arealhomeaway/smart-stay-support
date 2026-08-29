ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS upload_key text,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'stored',
  ADD COLUMN IF NOT EXISTS requested_from text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.documents ADD CONSTRAINT documents_upload_status_chk
    CHECK (upload_status IN ('pending','stored','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD CONSTRAINT documents_requested_from_chk
    CHECK (requested_from IS NULL OR requested_from IN ('owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS documents_upload_key_once
  ON public.documents (upload_key) WHERE upload_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_property_idx ON public.documents (property_id);
CREATE INDEX IF NOT EXISTS documents_live_idx ON public.documents (entity_type, entity_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.owner_can_see_property(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_program_properties opp
    JOIN public.owner_programs p ON p.id = opp.program_id
    WHERE p.owner_user_id = _user_id
      AND opp.property_id = _property_id
      AND opp.inclusion_status = 'included'
      AND opp.archived_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.owner_can_see_property(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_can_see_property(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "documents_read_owner_shared" ON public.documents;
CREATE POLICY "documents_read_owner_shared" ON public.documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND property_id IS NOT NULL
    AND (visibility = 'owner_shared' OR requested_from = 'owner')
    AND public.owner_can_see_property(auth.uid(), property_id)
  );