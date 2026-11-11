SELECT set_config('request.jwt.claims', json_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);
SELECT code, public.ao_card_set_status(id, 'released') AS version
  FROM public.ao_library_cards WHERE code = 'A56' AND status = 'retired';
