-- Practice for shannon-badge-refresh: apply.sql unchanged, read back, apply.undo.sql unchanged, read back,
-- all in one transaction that always rolls back (the last statement raises 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _out (n serial, line text) ON COMMIT DROP;
CREATE TEMP TABLE _counts ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM public.owner_notifications) AS notices, (SELECT count(*) FROM public.email_log) AS emails,
  (SELECT count(*) FROM public.home_chat_messages) AS chat,
  (SELECT count(*) FROM public.owner_program_events WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe') AS events,
  (SELECT md5(string_agg(code || trigger_rule || coalesce(review_note, '') || supporting::text || needs_review::text, '|' ORDER BY code))
     FROM public.owner_badges WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe') AS badge_md5;
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
DO $read$
DECLARE P uuid := '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe';
BEGIN
  INSERT INTO _out(line) SELECT 'after apply: ' || string_agg(code || ' ' || CASE WHEN needs_review THEN 'flagged (hidden)' ELSE 'shown' END, ', ' ORDER BY code)
    FROM public.owner_badges WHERE program_id = P;
  INSERT INTO _out(line) SELECT format('new history lines %s (%s), new owner notices %s, new emails %s, new chat lines %s',
    (SELECT count(*) FROM public.owner_program_events WHERE program_id = P) - c.events,
    (SELECT string_agg(kind || ':' || new_value, ', ' ORDER BY new_value) FROM public.owner_program_events WHERE program_id = P AND created_at = now()),
    (SELECT count(*) FROM public.owner_notifications) - c.notices, (SELECT count(*) FROM public.email_log) - c.emails,
    (SELECT count(*) FROM public.home_chat_messages) - c.chat) FROM _counts c;
END $read$;
-- Undo shannon-badge-refresh: puts the three badge rows back exactly as they were before the refresh
-- (needs_review = false, same rule text, note and supporting facts), from the copy kept in the apply audit line.
-- The three badge_flagged history lines stay, because badge history cannot be changed; the audit line below records the undo.
-- Note: the next time her page opens, the existing refresh would flag them again while her hours stay below the rule.
UPDATE public.owner_badges b SET needs_review = false, review_note = s.review_note, trigger_rule = s.trigger_rule, supporting = s.supporting
FROM jsonb_to_recordset((SELECT before_value FROM public.audit_log WHERE action = 'shannon_badge_refresh.apply'
                         ORDER BY created_at DESC LIMIT 1)) AS s(code text, trigger_rule text, review_note text, supporting jsonb)
WHERE b.program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe' AND b.code = s.code;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'shannon_badge_refresh.undo', 'owner_program', '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe',
  'Matt & Shannon Linder badges', 'Undo of shannon-badge-refresh: the three badges are shown as earned again.');
DO $check$
BEGIN
  INSERT INTO _out(line) SELECT 'after undo: badge rows identical to before ' || (
    (SELECT md5(string_agg(code || trigger_rule || coalesce(review_note, '') || supporting::text || needs_review::text, '|' ORDER BY code))
       FROM public.owner_badges WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe') = c.badge_md5)::text FROM _counts c;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK: %', (SELECT string_agg(line, ' | ' ORDER BY n) FROM _out);
END $check$;
