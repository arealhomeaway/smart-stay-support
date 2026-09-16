-- Restore the actual document baseline fields/policies missing from the small
-- earlier evidence fixtures. These are not production schema changes.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_label text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by uuid,ADD COLUMN IF NOT EXISTS delete_reason text;
ALTER TABLE documents ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE documents ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id),
 ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'document',
 ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal', ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS note text,ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id),
 ADD COLUMN IF NOT EXISTS original_filename text, ADD COLUMN IF NOT EXISTS mime_type text, ADD COLUMN IF NOT EXISTS size_bytes bigint,
 ADD COLUMN IF NOT EXISTS upload_key text,ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,ADD COLUMN IF NOT EXISTS requested_from text,
 ADD COLUMN IF NOT EXISTS category text,ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX documents_upload_key_once ON documents(upload_key) WHERE upload_key IS NOT NULL;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON documents TO authenticated;
GRANT ALL ON documents TO service_role;
CREATE POLICY documents_read_staff ON documents FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY documents_insert_staff ON documents FOR INSERT TO authenticated WITH CHECK(public.is_staff(auth.uid()) AND uploaded_by=auth.uid());
CREATE POLICY documents_update_sup ON documents FOR UPDATE TO authenticated USING(public.is_supervisor(auth.uid()) OR uploaded_by=auth.uid()) WITH CHECK(public.is_supervisor(auth.uid()) OR uploaded_by=auth.uid());
CREATE POLICY documents_read_owner_shared ON documents FOR SELECT TO authenticated USING(deleted_at IS NULL AND property_id IS NOT NULL AND (visibility='owner_shared' OR requested_from='owner'));
ALTER TABLE ticket_activity ADD COLUMN IF NOT EXISTS author_id uuid, ADD COLUMN IF NOT EXISTS kind text,ADD COLUMN IF NOT EXISTS event_type text,ADD COLUMN IF NOT EXISTS internal boolean,ADD COLUMN IF NOT EXISTS body text;
