ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_category_chk;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_category_chk CHECK (
    category IS NULL OR category IN (
      'insurance','hoa','permit_license','warranty','manual','reference','other'
    )
  );