DO $pre$
DECLARE bad text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ao_library_cards' AND column_name = 'owner_needed') THEN
    RAISE EXCEPTION 'Changed since Nov 15: ao_library_cards.owner_needed already exists. Nothing was changed.';
  END IF;
  SELECT string_agg(f, ', ') INTO bad FROM (VALUES
      ('private', 'ao_unlock', '306e6a849b808a1410923c4a759fffa2'),
      ('private', 'ao_plan_outcomes', '6e9836492b924d5c031ec26ab2f96c4b'),
      ('private', 'ao_ops_card_rule', 'c9c6f854133ab2856001e3852d9bfbcc'),
      ('private', 'ao_on_handoff', 'e169cb4fca408e7a3e6310eeddb77ebb'),
      ('public', 'ao_process_clocks', '5c370340180f4ebe8703ee52bcd68840')) v(s, f, h)
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = v.s AND p.proname = v.f AND md5(p.prosrc) = v.h);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Changed since Nov 15: %. Nothing was changed.', bad; END IF;
  IF (SELECT count(*) FROM public.ao_library_cards WHERE code IN
      ('A22','A24','A40','P01','P02','A03','A25','A26','A27','A28','A30','A39','A58','P03','P04')) <> 15 THEN
    RAISE EXCEPTION 'Changed since Nov 15: the 15 owner-needed card codes are not all in the library. Nothing was changed.';
  END IF;
END $pre$;
