DO $do$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef('public.read_completed_onboarding_records(uuid)'::regprocedure) INTO def;
  IF position('synthetic_property_guard' in def) = 0 THEN
    def := replace(def,
      $a$  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = _property_id AND archived_at IS NULL) THEN$a$,
      $b$  PERFORM private.synthetic_property_guard(_property_id);
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = _property_id AND archived_at IS NULL) THEN$b$);
    EXECUTE def;
  END IF;
END $do$;