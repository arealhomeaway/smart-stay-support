-- Home, the rest (build 3 of 7): no database change. This is the cancelled live check
-- of the My scorecard rule (nothing kept). Run Nov 10 2026 UTC.
-- Result: today the test person sees a record: 0; with a record about them: 1;
-- another coordinator sees a record of their own: 0. Afterwards scorecard_records had 0 rows.
DO $final$
DECLARE
  _a uuid := '1a4b8de5-0824-4066-8691-8e6bb912f964';   -- a coordinator (test person)
  _b uuid := '29380b2b-a59f-4de4-8588-7bcfebfc2d36';   -- another coordinator
  _sup uuid := 'ea6708cd-7f53-4b36-bec8-f5b2a597e6db';
  _out text := '';
  _n int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO _n FROM (SELECT id FROM public.scorecard_records WHERE (recorded_by = _a OR about_user_id = _a) AND is_demo = false LIMIT 1) x;
  RESET ROLE;
  _out := _out || format(E'\nToday, test person sees a record: %s', _n);

  INSERT INTO public.scorecard_records (kind, recorded_by, about_user_id, details, is_demo)
  VALUES ('coaching_cycle', _sup, _a, jsonb_build_object('practice', true), false);

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO _n FROM (SELECT id FROM public.scorecard_records WHERE (recorded_by = _a OR about_user_id = _a) AND is_demo = false LIMIT 1) x;
  RESET ROLE;
  _out := _out || format(E'\nWith a record about them, test person sees: %s', _n);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO _n FROM (SELECT id FROM public.scorecard_records WHERE (recorded_by = _b OR about_user_id = _b) AND is_demo = false LIMIT 1) x;
  RESET ROLE;
  _out := _out || format(E'\nAnother coordinator sees a record of their own: %s', _n);

  RAISE EXCEPTION 'FINAL CHECK (rolled back): %', _out;
END;
$final$;
