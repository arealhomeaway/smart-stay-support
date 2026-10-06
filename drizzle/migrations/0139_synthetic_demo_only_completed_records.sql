CREATE OR REPLACE FUNCTION public.can_read_completed_onboarding_document(_document_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE doc documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(private.is_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'Completed onboarding records are available to ARHA staff only.';
  END IF;
  SELECT * INTO doc FROM documents WHERE id = _document_id;
  IF doc.id IS NULL OR doc.property_id IS NULL OR NOT private.completed_onboarding_doc_ok(doc, doc.property_id) THEN
    RAISE EXCEPTION 'That file is not part of a completed onboarding record.';
  END IF;
  IF private.is_synthetic_account() AND doc.is_demo IS NOT TRUE THEN
    RAISE EXCEPTION 'Test accounts can only open demo records.';
  END IF;
  RETURN doc.storage_path;
END $function$;

CREATE OR REPLACE FUNCTION private.synthetic_property_guard(_property_id uuid)
 RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF private.is_synthetic_account() AND NOT EXISTS (SELECT 1 FROM properties WHERE id = _property_id AND is_demo) THEN
    RAISE EXCEPTION 'Test accounts can only open demo records.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.read_completed_onboarding_records_guard()
 RETURNS void LANGUAGE sql AS $$ SELECT NULL::void $$;
DROP FUNCTION public.read_completed_onboarding_records_guard();