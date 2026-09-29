-- Always recalculate from the newest Breezeway revision of a Task (by the
-- source's own update time), not the order our copies happened to arrive in.
DO $$
DECLARE f oid; d text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p WHERE p.proname = 'cleaner_recompute_core' LOOP
    d := pg_get_functiondef(f);
    IF position('ORDER BY synced_at DESC, id DESC LIMIT 1' in d) = 0 THEN
      RAISE EXCEPTION 'cleaner_recompute_core snapshot ordering not found';
    END IF;
    d := replace(d, 'ORDER BY synced_at DESC, id DESC LIMIT 1',
                    'ORDER BY source_updated_at DESC NULLS LAST, synced_at DESC, id DESC LIMIT 1');
    EXECUTE d;
  END LOOP;
END $$;