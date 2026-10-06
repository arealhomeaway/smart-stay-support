DO $$
DECLARE r record;
BEGIN
  -- Every RLS table carrying is_demo: synthetic test accounts see/change demo rows only.
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=c.relname AND k.column_name='is_demo')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Synthetic accounts: demo records only" ON public.%I', r.relname);
    EXECUTE format($p$CREATE POLICY "Synthetic accounts: demo records only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT (SELECT private.is_synthetic_account()) OR is_demo IS TRUE)
      WITH CHECK (NOT (SELECT private.is_synthetic_account()) OR is_demo IS TRUE)$p$, r.relname);
  END LOOP;
  -- Tables with a property but no demo flag: follow the home's demo flag.
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=c.relname AND k.column_name='property_id' AND k.data_type='uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=c.relname AND k.column_name='is_demo')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Synthetic accounts: demo records only" ON public.%I', r.relname);
    EXECUTE format($p$CREATE POLICY "Synthetic accounts: demo records only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT (SELECT private.is_synthetic_account()) OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_demo))
      WITH CHECK (NOT (SELECT private.is_synthetic_account()) OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_demo))$p$, r.relname);
  END LOOP;
END $$;