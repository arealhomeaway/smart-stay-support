-- Build 18 data part (Emily, Nov 10). Items 4, 5 and 6c. Each step only acts on the exact
-- current value, so a repeat changes nothing.
-- Acts as the approving Admin through the canonical card RPCs so every change gets a version
-- and an ao_library_card_history row with who and when. Nothing is released or sent.
SELECT set_config('request.jwt.claims', json_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, false);
SELECT set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', false);

-- Item 4: eight card titles. Only the title; status and release unchanged.
SELECT 'N05' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research travel-nurse and staffing agencies in your area and document it. Share information with us so we can build relationships$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N05' AND title = $t$Research travel-nurse and staffing agencies in your area$t$;
SELECT 'N06' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research corporate relocation and HR housing contacts and document it. Share information with us so we can build relationships$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N06' AND title = $t$Research corporate relocation and HR housing contacts$t$;
SELECT 'N07' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research insurance-housing providers and adjuster contacts and document it. Share information with us so we can build relationships$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N07' AND title = $t$Research insurance-housing providers and adjuster contacts$t$;
SELECT 'N08' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research universities, residencies and training programs nearby and document it. Share information with us so we can build relationships$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N08' AND title = $t$Research universities, residencies and training programs nearby$t$;
SELECT 'P09' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research comparable homes and positioning and provide guidance on how you want your home to stand out.$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P09' AND title = $t$Research comparable homes and positioning$t$;
SELECT 'P16' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Build a referral contact list based on your personal connections$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P16' AND title = $t$Build a referral contact list$t$;
SELECT 'P17' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research employers, hospitals, relocation and insurance housing and document it. Share information with us so we can build relationships$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P17' AND title = $t$Research employers, hospitals, relocation and insurance housing$t$;
SELECT 'P18' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research community and business partnerships and document it. Share information with us so we can build relationships$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P18' AND title = $t$Research community and business partnerships$t$;

-- Item 5: retire the two draft cards A15 and A41 (kept, not deleted). A27, A28 and A58 untouched.
SELECT code, public.ao_card_set_status(id, 'retired') AS version
  FROM public.ao_library_cards WHERE code IN ('A15', 'A41') AND status = 'draft';

-- Item 6c: three OwnerRez reviews whose date was the import time; mark date unknown (Build 17 marker).
UPDATE public.guest_feedback SET published_date_known = false
 WHERE id IN ('97dc0988-9fdb-473b-8684-e9e4ee3d220e', '115cf9a3-0256-4611-bdb4-273054856f0e', '4daf3acd-4eaa-4511-b078-f7d52c9cc794')
   AND source = 'ownerrez' AND published_date_known = true;
