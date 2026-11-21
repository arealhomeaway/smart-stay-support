-- shannon-badge-refresh: run the existing badge refresh (refresh_owner_badges, unchanged) once for Shannon Linder's
-- program 579cb6ae-c5a5-4aa3-aac2-64eedd2faafe on her corrected hours (33 entries, 2,523 minutes).
-- Expected: halfway, strong_finish and on_track_owner flagged (needs_review = true); nothing awarded or recovered;
-- first_step, building_momentum, engaged_owner and consistent_participation unchanged. The refresh writes one
-- badge_flagged history line per flagged badge. It sends no notice or email. It stops and changes nothing if the
-- result differs from what is expected.
DO $apply$
DECLARE P uuid := '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe'; ADMIN uuid := '98bd6696-4018-4965-b645-0471c5ae3925'; r jsonb; before jsonb;
BEGIN
  -- The three rows as they are now, kept in the audit line so the undo can put them back exactly.
  SELECT jsonb_agg(jsonb_build_object('code', code, 'trigger_rule', trigger_rule, 'review_note', review_note, 'supporting', supporting) ORDER BY code)
    INTO before FROM public.owner_badges WHERE program_id = P AND code IN ('halfway', 'on_track_owner', 'strong_finish');
  r := public.refresh_owner_badges(P, (SELECT report_version FROM public.owner_programs WHERE id = P), ADMIN);
  IF jsonb_array_length(r->'awarded') <> 0 OR jsonb_array_length(r->'recovered') <> 0
     OR (SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(r->'flagged') x) IS DISTINCT FROM ARRAY['halfway','on_track_owner','strong_finish'] THEN
    RAISE EXCEPTION 'STOP: badge refresh result differs from the expected one: %', r;
  END IF;
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (ADMIN, 'Admin', 'shannon_badge_refresh.apply', 'owner_program', P, 'Matt & Shannon Linder badges',
    'Existing badge refresh run on corrected hours: halfway, strong_finish and on_track_owner flagged and hidden. Undo: docs/pending/shannon-badge-refresh/apply.undo.sql.',
    before, r);
END $apply$;
