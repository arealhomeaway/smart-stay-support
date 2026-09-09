DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_demo_environment' AND p.pronargs = 1;

  IF d IS NULL THEN
    RAISE EXCEPTION 'seed_demo_environment(uuid) not found';
  END IF;

  d := replace(d, '''20 hours'',''p2'',''accepted''', '''20 hours'',''supervisor'',''accepted''');
  d := replace(d, '''20 min'',''p2'',''not_started''', '''20 min'',''supervisor'',''not_started''');

  IF d LIKE '%''p2'',''accepted''%' OR d LIKE '%''p2'',''not_started''%' THEN
    RAISE EXCEPTION 'escalation_level literals were not replaced';
  END IF;

  EXECUTE d;
END $$;