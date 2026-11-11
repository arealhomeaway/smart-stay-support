-- Fix 6: retire A56 (Ledger 38). Kept, not deleted; a version and history row with who and when.
-- Acts as the approving Admin through the canonical card action. A repeat changes nothing.
SELECT set_config('request.jwt.claims', json_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);
SELECT code, public.ao_card_set_status(id, 'retired') AS version
  FROM public.ao_library_cards WHERE code = 'A56' AND status = 'released';
