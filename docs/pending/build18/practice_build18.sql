-- Practice for Build 18, run once on the real database and cancelled on purpose (nothing kept).
-- Applies the payouts function, the Edit selected helper and the whole data part (02) in one step
-- as the approving Admin, reads the results, repeats the data part, then raises an error so every
-- change is rolled back. The card function (private.bonus_compute) is proved by the isolated
-- tests and read back on the live database after the schema part is applied.
DO $practice$
DECLARE
  _admin uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  _out jsonb; _hist_before int; _home uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _admin::text, true);
  SELECT count(*) INTO _hist_before FROM public.ao_library_card_history h JOIN public.ao_library_cards c ON c.id = h.card_id WHERE c.code IN ('N05','N06','N07','N08','P09','P16','P17','P18','A15','A41');
  EXECUTE $p1$CREATE OR REPLACE FUNCTION public.bonus_payouts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF NOT (private.bonus_is_leader(_me) OR public.is_finance_lead(_me)) THEN
    RAISE EXCEPTION 'Only Finance, the COO, the CEO and Admin see bonus payouts.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', b.id, 'plan', b.plan_code, 'plan_name', p.name, 'user_id', b.user_id,
             'person', coalesce(pr.full_name, 'Team member'), 'period_start', b.period_start, 'period_end', b.period_end,
             'label', b.label, 'status', b.status,
             'total', CASE WHEN b.status = 'verified' THEN b.total END,
             'verified_at', CASE WHEN b.status = 'verified' THEN b.verified_at END,
             'verified_by', CASE WHEN b.status = 'verified' THEN (SELECT full_name FROM public.profiles WHERE id = b.verified_by) END,
             'goals', CASE WHEN b.status = 'verified' THEN
                        (SELECT jsonb_agg(jsonb_build_object('name', e ->> 'name', 'value', e -> 'value', 'unit', e ->> 'unit',
                                                             'status', e ->> 'status', 'level', e ->> 'level', 'dollars', e -> 'dollars'))
                           FROM jsonb_array_elements(b.snapshot -> 'goals') e)
                      ELSE '[]'::jsonb END)
             ORDER BY b.period_start DESC, p.position, pr.full_name)
      FROM public.bonus_periods b
      JOIN public.bonus_plans p ON p.code = b.plan_code
      LEFT JOIN public.profiles pr ON pr.id = b.user_id), '[]'::jsonb);
END $$;

$p1$;
  EXECUTE $p3$CREATE OR REPLACE FUNCTION public.can_bulk_edit_home_tasks(_property_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  -- Exactly the people bulk_update_onboarding_home_tasks lets save: onboarding staff who are a
  -- Supervisor or Admin, the Director of Onboarding, or this home's Project Manager or Director.
  SELECT auth.uid() IS NOT NULL
     AND coalesce(private.is_onboarding_staff(auth.uid()), false)
     AND EXISTS (
       SELECT 1 FROM (
         SELECT project_manager, director FROM public.onboarding_projects
          WHERE property_id = _property_id AND status <> 'cancelled'
          ORDER BY created_at DESC LIMIT 1
       ) p
       WHERE coalesce(private.is_onboarding_leader(auth.uid()) OR p.project_manager = auth.uid() OR p.director = auth.uid(), false)
     )
$$;
REVOKE ALL ON FUNCTION public.can_bulk_edit_home_tasks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_bulk_edit_home_tasks(uuid) TO authenticated, service_role;
$p3$;
  EXECUTE $p2$SELECT 'N05' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research travel-nurse and staffing agencies in your area and document it. Share information with us so we can build relationships$t$::text)) AS version
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
SELECT code, public.ao_card_set_status(id, 'retired') AS version
  FROM public.ao_library_cards WHERE code IN ('A15', 'A41') AND status = 'draft';
UPDATE public.guest_feedback SET published_date_known = false
 WHERE id IN ('97dc0988-9fdb-473b-8684-e9e4ee3d220e', '115cf9a3-0256-4611-bdb4-273054856f0e', '4daf3acd-4eaa-4511-b078-f7d52c9cc794')
   AND source = 'ownerrez' AND published_date_known = true;$p2$;
  SELECT p.property_id INTO _home FROM public.onboarding_projects p WHERE p.status <> 'cancelled' ORDER BY p.created_at DESC LIMIT 1;
  _out := jsonb_build_object(
    'cards', (SELECT jsonb_agg(jsonb_build_object('code', code, 'status', status, 'version', version, 'title', title) ORDER BY code)
                FROM public.ao_library_cards WHERE code IN ('N05','N06','N07','N08','P09','P16','P17','P18','A15','A41','A27','A28','A58')),
    'history_added', (SELECT count(*) FROM public.ao_library_card_history h JOIN public.ao_library_cards c ON c.id = h.card_id WHERE c.code IN ('N05','N06','N07','N08','P09','P16','P17','P18','A15','A41')) - _hist_before,
    'reviews', (SELECT jsonb_agg(jsonb_build_object('id', left(id::text, 8), 'known', published_date_known)) FROM public.guest_feedback
                WHERE id IN ('97dc0988-9fdb-473b-8684-e9e4ee3d220e','115cf9a3-0256-4611-bdb4-273054856f0e','4daf3acd-4eaa-4511-b078-f7d52c9cc794')),
    'payout_rows', jsonb_array_length(coalesce(public.bonus_payouts(), '[]'::jsonb)),
    'payout_rows_with_pays_on', (SELECT count(*) FROM jsonb_array_elements(coalesce(public.bonus_payouts(), '[]'::jsonb)) e WHERE e ? 'pays_on'),
    'admin_can_edit_latest_home', public.can_bulk_edit_home_tasks(_home));
  EXECUTE $p2$SELECT 'N05' AS card, public.ao_card_save(id, jsonb_build_object('title', $t$Research travel-nurse and staffing agencies in your area and document it. Share information with us so we can build relationships$t$::text)) AS version
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
SELECT code, public.ao_card_set_status(id, 'retired') AS version
  FROM public.ao_library_cards WHERE code IN ('A15', 'A41') AND status = 'draft';
UPDATE public.guest_feedback SET published_date_known = false
 WHERE id IN ('97dc0988-9fdb-473b-8684-e9e4ee3d220e', '115cf9a3-0256-4611-bdb4-273054856f0e', '4daf3acd-4eaa-4511-b078-f7d52c9cc794')
   AND source = 'ownerrez' AND published_date_known = true;$p2$;
  _out := _out || jsonb_build_object('history_added_after_repeat',
    (SELECT count(*) FROM public.ao_library_card_history h JOIN public.ao_library_cards c ON c.id = h.card_id WHERE c.code IN ('N05','N06','N07','N08','P09','P16','P17','P18','A15','A41')) - _hist_before);
  RAISE EXCEPTION 'PRACTICE RESULT (cancelled on purpose): %', _out::text;
END $practice$;
