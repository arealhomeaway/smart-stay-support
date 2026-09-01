ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_category_chk;
ALTER TABLE public.documents ADD CONSTRAINT documents_category_chk CHECK (
  category IS NULL OR category = ANY (ARRAY[
    'pma','insurance','ownership',
    'hoa','covenants','permit_license','compliance',
    'manual','hvac_doc','warranty','equipment',
    'access_security',
    'measurements','design','onboarding_evidence',
    'assessment','operations','maintenance',
    'media',
    'reference','other'
  ]::text[])
);