DO $do$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef('public.owner_completions_for_review(boolean, uuid)'::regprocedure) INTO def;
  IF position('is_synthetic_account' in def) = 0 THEN
    def := replace(def, 'AND w.is_demo = _demo AND', 'AND w.is_demo = (_demo OR private.is_synthetic_account()) AND');
    EXECUTE def;
  END IF;
END $do$;