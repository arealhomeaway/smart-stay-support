DO $pre$
DECLARE bad text;
BEGIN
  SELECT string_agg(s || '.' || f, ', ') INTO bad FROM (VALUES
      ('private', 'guard_owner_lifecycle_writes', 'b4341164cf4b505110b1a839015b6cdf'),
      ('private', 'ao_unlock', '80ef4c0ab05a5edcf7e76f758bff4114'),
      ('public', 'ao_process_clocks', 'a8db309766e1a14ac5de86cf69518753')) v(s, f, h)
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = v.s AND p.proname = v.f AND md5(p.prosrc) = v.h);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Changed since Nov 15 capture: %. Nothing was changed.', bad; END IF;
END $pre$;
