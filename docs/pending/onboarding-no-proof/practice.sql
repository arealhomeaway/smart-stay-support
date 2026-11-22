-- Practice for onboarding-no-proof on 3400 N Fern Avenue, signed in as the Director of Onboarding:
-- Mark done with no note before (refused), apply.sql unchanged, Mark done with no note after (saved),
-- apply.undo.sql unchanged, definitions back to before. Always rolls back (ends with 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _p(n serial, line text);
CREATE TEMP TABLE _b AS SELECT
  (SELECT string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('bulk_complete_onboarding_tasks','complete_onboarding_from_breezeway','create_onboarding_handoff')) AS defs,
  (SELECT count(*) FROM public.owner_notifications) AS notices, (SELECT count(*) FROM public.email_log) AS emails;
SELECT set_config('request.jwt.claims', json_build_object('sub', '40de2f41-5596-4ec1-98d7-29e16549a25f', 'role', 'authenticated')::text, true);
DO $t$ DECLARE r jsonb; BEGIN
  BEGIN
    r := public.bulk_complete_onboarding_tasks('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', ARRAY['86dce229-e685-4956-93e9-d2cbdd24baaa']::uuid[], '', NULL, NULL, false);
    INSERT INTO _p(line) VALUES ('before, Mark done with no note: saved ' || coalesce(r->>'completed', '?'));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _p(line) VALUES ('before, Mark done with no note: refused: ' || SQLERRM);
  END;
END $t$;
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
-- ===== apply.sql (unchanged) =====
-- onboarding-no-proof (Nov 22, decisions O7 and O8 changed by the Admin): onboarding Tasks no longer
-- require or ask for proof. One transaction. Removes only the three proof checks below, inside the live
-- definitions, so every other rule in each function stays exactly as it is. Owners and grants are kept
-- (CREATE OR REPLACE from pg_get_functiondef). No Task, template or saved note is changed.
--  1. bulk_complete_onboarding_tasks (Mark done): no longer refuses a save without a 5 character note.
--  2. complete_onboarding_from_breezeway: no longer skips a Task that has no proof note.
--  3. create_onboarding_handoff: no longer refuses a handoff because a Task has no proof note.
DO $patch$
DECLARE
  def text;
  f_bulk regprocedure := 'public.bulk_complete_onboarding_tasks(uuid,uuid[],text,date,uuid,boolean)';
  f_bw regprocedure;
  f_ho regprocedure;
  old_bulk text := $o$  IF NOT _dry_run AND char_length(_note_clean) < 5 THEN
    RAISE EXCEPTION 'Add a note that says where the proof is (at least 5 characters).';
  END IF;
$o$;
  new_bulk text := $o$  -- Nov 22 (O7, O8 changed): no proof note is required.
$o$;
  old_bw text := $o$ OR (task.evidence_required AND btrim(coalesce(task.evidence_note,''))='')$o$;
  new_bw text := $o$ /* Nov 22 (O7, O8 changed): no proof check */$o$;
  old_ho text := $o$ OR (evidence_required AND length(trim(coalesce(evidence_note,'')))=0)$o$;
  new_ho text := $o$ /* Nov 22 (O7, O8 changed): no proof check */$o$;
  old_msg text := 'Required work, approvals, evidence or blockers prevent handoff.';
  new_msg text := 'Required work, approvals or blockers prevent handoff.';
BEGIN
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'onboarding_no_proof.apply') THEN
    RAISE EXCEPTION 'onboarding-no-proof: already applied';
  END IF;
  SELECT p.oid::regprocedure INTO f_bw FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'complete_onboarding_from_breezeway';
  SELECT p.oid::regprocedure INTO f_ho FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_onboarding_handoff';
  IF f_bw IS NULL OR f_ho IS NULL THEN RAISE EXCEPTION 'onboarding-no-proof: a function is missing'; END IF;

  def := pg_get_functiondef(f_bulk);
  IF (length(def) - length(replace(def, old_bulk, ''))) / length(old_bulk) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof: Mark done proof check not found exactly once';
  END IF;
  EXECUTE replace(def, old_bulk, new_bulk);

  def := pg_get_functiondef(f_bw);
  IF (length(def) - length(replace(def, old_bw, ''))) / length(old_bw) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof: Breezeway completion proof check not found exactly once';
  END IF;
  EXECUTE replace(def, old_bw, new_bw);

  def := pg_get_functiondef(f_ho);
  IF (length(def) - length(replace(def, old_ho, ''))) / length(old_ho) <> 1
     OR (length(def) - length(replace(def, old_msg, ''))) / length(old_msg) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof: handoff proof check not found exactly once';
  END IF;
  EXECUTE replace(replace(def, old_ho, new_ho), old_msg, new_msg);

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (NULL, 'onboarding_no_proof.apply', 'function', NULL, 'Onboarding Tasks need no proof (O7, O8 changed)',
    jsonb_build_object('functions', jsonb_build_array('bulk_complete_onboarding_tasks', 'complete_onboarding_from_breezeway', 'create_onboarding_handoff')));
END $patch$;
-- ===== after apply =====
SELECT set_config('request.jwt.claims', json_build_object('sub', '40de2f41-5596-4ec1-98d7-29e16549a25f', 'role', 'authenticated')::text, true);
DO $t$ DECLARE r jsonb; BEGIN
  BEGIN
    r := public.bulk_complete_onboarding_tasks('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', ARRAY['86dce229-e685-4956-93e9-d2cbdd24baaa']::uuid[], '', NULL, NULL, false);
    INSERT INTO _p(line) VALUES ('after, Mark done with no note: saved ' || coalesce(r->>'completed', '?') || ', held ' || coalesce(jsonb_array_length(r->'held'), 0));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _p(line) VALUES ('after, Mark done with no note: refused: ' || SQLERRM);
  END;
END $t$;
INSERT INTO _p(line) SELECT format('Purchase essentials now: status %s, done by Director %s, note "%s"', status, (completed_by = '40de2f41-5596-4ec1-98d7-29e16549a25f')::text, coalesce(evidence_note, ''))
  FROM public.onboarding_tasks WHERE id = '86dce229-e685-4956-93e9-d2cbdd24baaa';
INSERT INTO _p(line) SELECT 'proof checks left in the three functions: ' || (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('bulk_complete_onboarding_tasks','complete_onboarding_from_breezeway','create_onboarding_handoff')
    AND (p.prosrc LIKE '%where the proof is%' OR p.prosrc LIKE '%evidence_required AND%'));
INSERT INTO _p(line) SELECT format('notices %s, emails %s', (SELECT count(*) FROM public.owner_notifications) - notices, (SELECT count(*) FROM public.email_log) - emails) FROM _b;
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
-- ===== apply.undo.sql (unchanged) =====
-- onboarding-no-proof undo: puts the three proof checks back exactly as they were, inside the live
-- definitions (reverse of apply.sql). One transaction. One audit row.
DO $undo$
DECLARE
  def text;
  f_bulk regprocedure := 'public.bulk_complete_onboarding_tasks(uuid,uuid[],text,date,uuid,boolean)';
  f_bw regprocedure;
  f_ho regprocedure;
  old_bulk text := $o$  IF NOT _dry_run AND char_length(_note_clean) < 5 THEN
    RAISE EXCEPTION 'Add a note that says where the proof is (at least 5 characters).';
  END IF;
$o$;
  new_bulk text := $o$  -- Nov 22 (O7, O8 changed): no proof note is required.
$o$;
  old_bw text := $o$ OR (task.evidence_required AND btrim(coalesce(task.evidence_note,''))='')$o$;
  new_bw text := $o$ /* Nov 22 (O7, O8 changed): no proof check */$o$;
  old_ho text := $o$ OR (evidence_required AND length(trim(coalesce(evidence_note,'')))=0)$o$;
  new_ho text := $o$ /* Nov 22 (O7, O8 changed): no proof check */$o$;
  old_msg text := 'Required work, approvals, evidence or blockers prevent handoff.';
  new_msg text := 'Required work, approvals or blockers prevent handoff.';
BEGIN
  SELECT p.oid::regprocedure INTO f_bw FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'complete_onboarding_from_breezeway';
  SELECT p.oid::regprocedure INTO f_ho FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_onboarding_handoff';

  def := pg_get_functiondef(f_bulk);
  IF (length(def) - length(replace(def, new_bulk, ''))) / length(new_bulk) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof undo: Mark done marker not found exactly once';
  END IF;
  EXECUTE replace(def, new_bulk, old_bulk);

  def := pg_get_functiondef(f_bw);
  IF (length(def) - length(replace(def, new_bw, ''))) / length(new_bw) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof undo: Breezeway completion marker not found exactly once';
  END IF;
  EXECUTE replace(def, new_bw, old_bw);

  def := pg_get_functiondef(f_ho);
  IF (length(def) - length(replace(def, new_ho, ''))) / length(new_ho) <> 1
     OR (length(def) - length(replace(def, new_msg, ''))) / length(new_msg) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof undo: handoff marker not found exactly once';
  END IF;
  EXECUTE replace(replace(def, new_ho, old_ho), new_msg, old_msg);

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (NULL, 'onboarding_no_proof.undone', 'function', NULL, 'Onboarding proof checks restored', '{}'::jsonb);
END $undo$;
INSERT INTO _p(line) SELECT 'after undo, the three definitions match before: ' || ((SELECT string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' ORDER BY p.proname)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('bulk_complete_onboarding_tasks','complete_onboarding_from_breezeway','create_onboarding_handoff')) = defs)::text FROM _b;
DO $out$ DECLARE s text; BEGIN SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p; RAISE EXCEPTION E'PRACTICE ROLLED BACK\n%', s; END $out$;
