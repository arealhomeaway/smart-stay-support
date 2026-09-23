ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS owner_category text
  CHECK (owner_category IS NULL OR owner_category IN ('property_document','photo','receipt','research','participation','other'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS documents_work_item_idx ON public.documents(work_item_id) WHERE work_item_id IS NOT NULL;

-- Owners may add a general file to a home they can reach (property records only);
-- ticket/task records still need a coordinator request.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.begin_attachment_upload(uuid,jsonb)'::regprocedure);
  def := replace(def, 'ELSIF NOT staff THEN RAISE EXCEPTION ''Your coordinator has not requested a document here''',
                      'ELSIF NOT staff AND _input->>''entityType''<>''property'' THEN RAISE EXCEPTION ''Your coordinator has not requested a document here''');
  IF position('_input->>''entityType''<>''property''' in def) = 0 THEN RAISE EXCEPTION 'patch failed'; END IF;
  EXECUTE def;
END $$;

-- Tags the uploader's own file with its owner-facing category and optional Opportunity.
CREATE OR REPLACE FUNCTION public.tag_owner_upload(_document_id uuid, _owner_category text, _work_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.documents;
BEGIN
  SELECT * INTO d FROM documents WHERE id = _document_id AND uploaded_by = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'This file is not yours to update.'; END IF;
  IF _work_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM work_items w JOIN owner_programs p ON p.id = w.program_id
     WHERE w.id = _work_item_id AND w.kind = 'opportunity' AND w.property_id = d.property_id
       AND (p.owner_user_id = auth.uid() OR is_staff(auth.uid()) OR is_onboarding_staff(auth.uid()))) THEN
    RAISE EXCEPTION 'That Opportunity belongs to a different home.';
  END IF;
  UPDATE documents SET owner_category = _owner_category, work_item_id = _work_item_id WHERE id = _document_id;
END $$;
REVOKE ALL ON FUNCTION public.tag_owner_upload(uuid,text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tag_owner_upload(uuid,text,uuid) TO authenticated;