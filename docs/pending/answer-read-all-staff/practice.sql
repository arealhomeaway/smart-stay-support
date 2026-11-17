-- Practice: runs apply.sql, checks reads/writes as five people, then the undo, and always rolls back.
CREATE TEMP TABLE _r(step text, who text, fern int, total int, upd int, del int);
GRANT ALL ON _r TO authenticated;
CREATE OR REPLACE FUNCTION pg_temp.probe(_step text) RETURNS void LANGUAGE plpgsql AS $p$
DECLARE u record; f int; t int; up int; de int;
BEGIN
  FOR u IN SELECT * FROM (VALUES
    ('PC day shift (Property Coordinator)', '1a4b8de5-0824-4066-8691-8e6bb912f964'::uuid),
    ('PM on another home', '82bdbc3a-791c-433a-9944-651661f89eb1'::uuid),
    ('Operations Supervisor', 'ea6708cd-7f53-4b36-bec8-f5b2a597e6db'::uuid),
    ('Fern homeowner', '80c6e551-e370-4ab3-bdfd-1cd7f5c39448'::uuid),
    ('Other homeowner', (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role='owner' AND ur.user_id <> '80c6e551-e370-4ab3-bdfd-1cd7f5c39448' AND NOT EXISTS (SELECT 1 FROM public.owner_programs op WHERE op.owner_user_id=ur.user_id AND op.property_id='e0fc2763-1186-4b5a-9866-2bd9ff86f55d') AND NOT EXISTS (SELECT 1 FROM public.ao_contributions c WHERE c.submitted_by=ur.user_id) LIMIT 1))
  ) v(who, uid) LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u.uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO f FROM public.ao_contributions WHERE property_id='e0fc2763-1186-4b5a-9866-2bd9ff86f55d';
    SELECT count(*) INTO t FROM public.ao_contributions;
    BEGIN
      UPDATE public.ao_contributions SET field_values = '{"x":"changed"}'::jsonb WHERE property_id='e0fc2763-1186-4b5a-9866-2bd9ff86f55d';
      GET DIAGNOSTICS up = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN up := -1; END;
    BEGIN
      DELETE FROM public.ao_contributions WHERE property_id='e0fc2763-1186-4b5a-9866-2bd9ff86f55d';
      GET DIAGNOSTICS de = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN de := -1; END;
    INSERT INTO _r VALUES (_step, u.who, f, t, up, de);
    EXECUTE 'RESET ROLE';
  END LOOP;
END $p$;
SELECT pg_temp.probe('before');
-- @@APPLY@@
SELECT pg_temp.probe('after');
-- @@UNDO@@
SELECT pg_temp.probe('after undo');
DO $d$ DECLARE s text; BEGIN
  SELECT string_agg(format('%s | %s: fern=%s total=%s update=%s delete=%s', step, who, fern, total, upd, del), E'\n' ORDER BY step, who) INTO s FROM _r;
  s := s || E'\npolicies now: ' || (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE tablename='ao_contributions');
  s := s || E'\nFern answers unchanged: ' || (SELECT count(*) FROM public.ao_contributions WHERE property_id='e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_values <> '{"x":"changed"}'::jsonb);
  RAISE EXCEPTION 'PRACTICE ROLLED BACK:%', E'\n' || s;
END $d$;
