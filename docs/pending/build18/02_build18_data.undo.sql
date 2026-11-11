-- Undo for 02_build18_data.sql. Puts each value back through the same RPCs. History stays
-- add-only, so the undo adds rows rather than removing the Build 18 rows.
-- Acts as the approving Admin through the canonical card RPCs so every change gets a version
-- and an ao_library_card_history row with who and when. Nothing is released or sent.
SELECT set_config('request.jwt.claims', json_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, false);
SELECT set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', false);
SELECT 'N05' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research travel-nurse and staffing agencies in your area$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N05' AND title = $t$Research travel-nurse and staffing agencies in your area and document it. Share information with us so we can build relationships$t$;
SELECT 'N06' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research corporate relocation and HR housing contacts$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N06' AND title = $t$Research corporate relocation and HR housing contacts and document it. Share information with us so we can build relationships$t$;
SELECT 'N07' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research insurance-housing providers and adjuster contacts$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N07' AND title = $t$Research insurance-housing providers and adjuster contacts and document it. Share information with us so we can build relationships$t$;
SELECT 'N08' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research universities, residencies and training programs nearby$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'N08' AND title = $t$Research universities, residencies and training programs nearby and document it. Share information with us so we can build relationships$t$;
SELECT 'P09' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research comparable homes and positioning$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P09' AND title = $t$Research comparable homes and positioning and provide guidance on how you want your home to stand out.$t$;
SELECT 'P16' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Build a referral contact list$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P16' AND title = $t$Build a referral contact list based on your personal connections$t$;
SELECT 'P17' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research employers, hospitals, relocation and insurance housing$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P17' AND title = $t$Research employers, hospitals, relocation and insurance housing and document it. Share information with us so we can build relationships$t$;
SELECT 'P18' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research community and business partnerships$t$::text)) AS version
  FROM public.ao_library_cards WHERE code = 'P18' AND title = $t$Research community and business partnerships and document it. Share information with us so we can build relationships$t$;
SELECT code, public.ao_card_set_status(id, 'draft') AS version
  FROM public.ao_library_cards WHERE code IN ('A15', 'A41') AND status = 'retired';
UPDATE public.guest_feedback SET published_date_known = true
 WHERE id IN ('97dc0988-9fdb-473b-8684-e9e4ee3d220e', '115cf9a3-0256-4611-bdb4-273054856f0e', '4daf3acd-4eaa-4511-b078-f7d52c9cc794')
   AND source = 'ownerrez' AND published_date_known = false;
